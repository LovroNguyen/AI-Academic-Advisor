# AcadAI Face Recognition Service

A Python (FastAPI) microservice that detects and recognizes student faces in a photo for attendance.

**It is never called by the browser.** The NestJS backend proxies every request through admin-only endpoints (`/api/face/*`) and authenticates to this service with a shared key. The recognized student IDs are stored through `POST /api/attendance/face-mark`.

```
Admin browser ──JWT (admin role)──▶ NestJS /api/face/* ──X-API-Key──▶ face service (127.0.0.1:8001)
```

## How it works

It uses classical computer vision only: OpenCV + NumPy, no deep-learning models and no cloud API.

1. **Decode**: base64 image → PIL (fixes smartphone EXIF rotation) → OpenCV BGR. Images larger than 1600 px are downscaled.
2. **Detect**: OpenCV Haar cascade (`haarcascade_frontalface_default.xml`), then Non-Maximum Suppression to remove duplicate boxes. If no face is found, the response says `face_count: 0`; nothing is matched.
3. **Encode**: grayscale face crop → resize to 100×100 → CLAHE contrast normalization → 5×5 grid × 16-bin intensity histograms = **400-dimensional vector**.
4. **Match**: cosine distance against every stored template; a match is accepted at distance ≤ `0.40` (adjustable per request through `tolerance`).
5. **Filter unknowns**: boxes that match nobody are kept as "unknown" only if an eye cascade finds eyes in them. Otherwise they are discarded as background clutter.

## Setup

Requires Python 3.10+.

```bash
cd face-service
python -m venv venv
venv\Scripts\activate          # Windows  (Linux/macOS: source venv/bin/activate)
pip install -r requirements.txt
copy .env.example .env         # then set FACE_SERVICE_API_KEY (same value as in backend/.env)
python main.py                 # → http://127.0.0.1:8001
```

On Windows you can run `start.bat` instead. It creates the venv, installs the requirements and starts the service.

### Configuration (`face-service/.env`)

| Variable | Default | Meaning |
|---|---|---|
| `FACE_SERVICE_API_KEY` | (none) | **Required.** Shared secret; must equal `FACE_SERVICE_API_KEY` in `backend/.env`. Without it every request except `/health` is rejected. |
| `FACE_SERVICE_HOST` | `127.0.0.1` | Bind address. Keep it on localhost unless the backend runs on another machine. |
| `FACE_ALLOWED_ORIGINS` | (empty) | Browser origins allowed by CORS. Normally empty, because browsers should not call this service. |

## API

All endpoints except `/health` require the header `X-API-Key: <FACE_SERVICE_API_KEY>`.

| Method | Path | Body | Description |
|---|---|---|---|
| GET | `/health` | – | Status and number of registered students |
| GET | `/students` | – | List of registered students (`student_id`, `student_name`) |
| POST | `/register` | `{ student_id, student_name, image_base64 }` | Enroll a face. Uses the largest face in the image |
| POST | `/recognize` | `{ image_base64, tolerance?=0.40, min_face_px?=35 }` | Detect and recognize all faces in the frame |
| POST | `/recognize-panoramic` | same as `/recognize` | Backward-compatible alias |
| DELETE | `/students/{student_id}` | – | Remove a student's template and photo |

`/recognize` returns `face_count`, `recognized[]` (with `student_id`, `student_name`, `confidence`, `bbox`), `unknown_count`, and `all_detections[]`.

## Biometric data and privacy

Face photos and templates are **biometric personal data**. Treat them accordingly:

- **Storage:** templates are in `faces_db/encodings.json` and reference photos in `faces_db/{student_id}.jpg`, as plain, unencrypted files. Never commit, copy, or share this folder. Restrict file access to the account that runs the service.
- **Access:** only admins can register, list, delete, or recognize faces (enforced by the backend). The service itself only accepts the backend's key and listens on localhost.
- **Consent:** a student's face must only be registered with their informed consent. Attendance must still be markable manually for students who decline (the Attendance page supports manual marking).
- **Retention and deletion:** delete a student's template when they leave or withdraw consent (`DELETE /api/face/students/:id`, or the admin UI). Deleting the template also deletes the photo. Delete all templates at the end of each academic year unless there is a documented reason to keep them.
- **Not implemented yet:** encryption at rest, an audit log of recognitions, a self-service consent and deletion flow for students.

## Known limitations

These belong in the project report's limitations section. See `ISSUES.md` #22–#26.

- **Weak features.** Histogram features are sensitive to lighting, pose, glasses, and image quality. The method has **not been evaluated on a real labelled photo set**, so there is no measured accuracy (TAR/FAR).
- **Small safety margin.** With only 3 enrolled students, the closest pair of *different* students is at distance 0.431, just above the 0.40 match threshold. With more students, false matches are likely.
- **No liveness or anti-spoofing.** A printed photo or a phone screen showing a registered student would be accepted. The `spoofed_recognized` field in the response is always empty. An admin must supervise face attendance and review the selected students before saving.
- **One template per student.** Registering again overwrites the old template.

## Benchmark

```bash
venv\Scripts\python.exe benchmark.py
```

Runs 6 sanity checks: template integrity, self-distance, inter-person separation, NMS de-duplication, clutter rejection, and latency (p95 < 250 ms). These are **not an accuracy evaluation**:
- Self-distance is 0 by definition.
- Separation is measured only between the enrolled templates.
- The multi-face and latency tests use synthetic images. Since a frame with no face now returns early, the latency test measures detection only.

## Ports

| Service | Port |
|---|---|
| Face service | 8001 (localhost only) |
| NestJS backend | 3000 |
| Vite frontend | 5173 |
