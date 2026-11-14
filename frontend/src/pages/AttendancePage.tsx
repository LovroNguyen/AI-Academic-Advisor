import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import api from "../services/api";
import { MIN_ATTENDANCE_RATE, attendanceRate, isAttendanceAtRisk, maxAllowedAbsences } from "../utils/grading";
import { useAuth } from "../context/AuthContext";
import { ClassItem, LessonItem } from "../types";
import {
  Camera,
  X,
  CheckCircle,
  AlertTriangle,
  Loader2,
  RotateCcw,
  Users,
  MapPin,
  Upload,
} from "lucide-react";

// Face recognition goes through the backend (/api/face/recognize, admin-only).

// ─── Types ───────────────────────────────────────────────────────────────────
interface FaceDetection {
  student_id: string;
  student_name: string;
  confidence: number;
  bbox: { top: number; right: number; bottom: number; left: number };
  status: "recognized" | "unknown";
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export const AttendancePage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const navigate = useNavigate();

  const [searchParams, setSearchParams] = useSearchParams();
  const queryClassId = searchParams.get("classId");

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [lessons, setLessons] = useState<LessonItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showFaceModal, setShowFaceModal] = useState(false);
  const [selectedLessonId, setSelectedLessonId] = useState<string>("");
  const [selectedLessonTopic, setSelectedLessonTopic] = useState<string>("");

  useEffect(() => {
    api
      .get("/classes")
      .then((r) => {
        const classList: ClassItem[] = isAdmin
          ? r.data
          : r.data.filter((c: ClassItem) => c.isEnrolled);
        setClasses(classList);
        if (classList.length > 0) {
          const matched = queryClassId && classList.some((c: ClassItem) => c.id === queryClassId);
          setSelectedClassId(matched ? queryClassId! : classList[0].id);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [queryClassId, isAdmin]);

  useEffect(() => {
    if (!selectedClassId) return;
    api
      .get(`/lessons?classId=${selectedClassId}`)
      .then((r) => setLessons(r.data))
      .catch(console.error);
  }, [selectedClassId]);

  const handleClassChange = (id: string) => {
    setSelectedClassId(id);
    setSearchParams({ classId: id });
  };

  const openFaceModal = (lessonId: string, topic: string) => {
    setSelectedLessonId(lessonId);
    setSelectedLessonTopic(topic);
    setShowFaceModal(true);
  };

  const cls = classes.find((c) => c.id === selectedClassId);
  const present = lessons.filter((l) => l.myAttendance?.status === "present").length;
  const absent = lessons.filter((l) => l.myAttendance?.status === "absent").length;
  // Shared rule (utils/grading.ts): present / recorded sessions; future or unrecorded lessons don't count.
  const total = lessons.filter((l) => l.myAttendance?.status).length;
  const rate = attendanceRate(present, total);
  const atRisk = isAttendanceAtRisk(rate);

  if (loading) return <div style={{ color: "#64748b", padding: 40 }}>Loading...</div>;

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance</h1>
          <p className="page-sub">
            {cls?.name || "Class"} ({cls?.subjectCode || ""}) &middot; Semester 5
          </p>
        </div>
        <select
          value={selectedClassId}
          onChange={(e) => handleClassChange(e.target.value)}
          className="uni-select"
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.subjectCode})
            </option>
          ))}
        </select>
      </div>

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div className="stat-card">
          <div className="stat-label">Attendance Rate</div>
          <div className="stat-value" style={{ color: atRisk ? "#d97706" : "#16a34a" }}>
            {rate !== null ? `${rate}%` : "—"}
          </div>
          <div className="stat-sub" style={{ color: atRisk ? "#d97706" : "#94a3b8" }}>
            {rate === null ? "No sessions recorded yet" : atRisk ? `Below minimum ${MIN_ATTENDANCE_RATE}%` : "Exam eligible"}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Present</div>
          <div className="stat-value" style={{ color: "#16a34a" }}>
            {present}
          </div>
          <div className="stat-sub">of {total} sessions</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Absences</div>
          <div className="stat-value" style={{ color: "#dc2626" }}>
            {absent}
          </div>
          <div className="stat-sub">{Math.max(0, maxAllowedAbsences(lessons.length) - absent)} more allowed</div>
        </div>
      </div>

      {rate !== null && rate <= MIN_ATTENDANCE_RATE + 5 && (
        <div className="alert-strip alert-warn" style={{ marginBottom: 16 }}>
          <strong>Notice:</strong> Attendance rate is {rate}%. Minimum {MIN_ATTENDANCE_RATE}% required for final exam.
        </div>
      )}

      {/* Sessions Table */}
      <div className="uni-card">
        <div className="uni-card-head">Sessions</div>
        <div style={{ overflowX: "auto" }}>
          <table className="uni-table">
            <thead>
              <tr>
                {["#", "Date", "Topic", "Room", "Status", ...(isAdmin ? ["Action"] : [])].map((h) => (
                  <th key={h} className="uni-th">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lessons.length === 0 ? (
                <tr>
                  <td
                    colSpan={isAdmin ? 6 : 5}
                    style={{ padding: "32px 16px", textAlign: "center", color: "#64748b", fontSize: 13 }}
                  >
                    No sessions scheduled yet.
                  </td>
                </tr>
              ) : (
                lessons.map((l, idx) => {
                  const s = l.myAttendance?.status || "present";
                  const bc = s === "present" ? "badge-green" : s === "absent" ? "badge-red" : "badge-yellow";
                  const label = s.charAt(0).toUpperCase() + s.slice(1);
                  return (
                    <tr
                      key={l.id}
                      className="uni-tr"
                      style={{ background: idx % 2 === 0 ? "#fff" : "#fafafa" }}
                    >
                      <td className="uni-td mono" style={{ fontSize: 12, color: "#94a3b8" }}>
                        {idx + 1}
                      </td>
                      <td className="uni-td" style={{ fontWeight: 500, whiteSpace: "nowrap" }}>
                        {new Date(l.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                      <td className="uni-td" style={{ fontWeight: 600, color: "#0f172a" }}>
                        {l.topic}
                      </td>
                      <td className="uni-td mono" style={{ fontSize: 12 }}>
                        <button
                          type="button"
                          onClick={() => navigate(`/map?room=${encodeURIComponent(l.room)}`)}
                          className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline transition-colors"
                          title={`Locate ${l.room}`}
                        >
                          <MapPin size={11} strokeWidth={1.5} />
                          <span>{l.room}</span>
                        </button>
                      </td>
                      <td className="uni-td">
                        <span className={`badge ${bc}`}>{label}</span>
                      </td>
                      {isAdmin && (
                        <td className="uni-td">
                          <button
                            onClick={() => openFaceModal(l.id, l.topic)}
                            className="btn-primary inline-flex items-center gap-1.5 shadow-sm"
                            style={{ padding: "6px 14px", fontSize: 12, borderRadius: 6 }}
                          >
                            <Camera size={13} strokeWidth={1.8} /> Attendance
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Unified Recognition Modal */}
      {showFaceModal && (
        <FaceRecognitionModal
          lessonId={selectedLessonId}
          lessonTopic={selectedLessonTopic}
          onClose={() => setShowFaceModal(false)}
          onMarked={() => {
            setShowFaceModal(false);
            api
              .get(`/lessons?classId=${selectedClassId}`)
              .then((r) => setLessons(r.data))
              .catch(console.error);
          }}
        />
      )}
    </div>
  );
};

// ─── Unified Attendance Modal ────────────────────────────────────────────────
interface FaceModalProps {
  lessonId: string;
  lessonTopic: string;
  onClose: () => void;
  onMarked: () => void;
}

const FaceRecognitionModal: React.FC<FaceModalProps> = ({
  lessonId,
  lessonTopic,
  onClose,
  onMarked,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [inputSource, setInputSource] = useState<"camera" | "upload">("camera");
  const [step, setStep] = useState<"capture" | "result" | "done">("capture");
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [capturing, setCapturing] = useState(false);

  const [capturedImageData, setCapturedImageData] = useState<string>("");
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number }>({
    width: 640,
    height: 480,
  });
  const [detections, setDetections] = useState<FaceDetection[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

  const [marking, setMarking] = useState(false);
  const [serviceError, setServiceError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const startCamera = useCallback(async () => {
    setCameraError("");
    const attempts = [
      { video: { width: { ideal: 1280 }, height: { ideal: 720 } } },
      { video: { width: { ideal: 640 }, height: { ideal: 480 } } },
      { video: true },
    ];
    for (const constraints of attempts) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints as MediaStreamConstraints);
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => setCameraReady(true);
        }
        return;
      } catch (e: any) {
        if (e.name === "NotAllowedError") {
          setCameraError("Camera permission denied. Please allow camera access in your browser.");
          return;
        }
        if (e.name === "NotReadableError") {
          setCameraError("Camera is currently in use by another app.");
          return;
        }
      }
    }
    setCameraError("Could not access camera. Please check camera connection.");
  }, []);

  useEffect(() => {
    if (step === "capture" && inputSource === "camera") {
      startCamera();
    }
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [startCamera, step, inputSource]);

  const captureFrame = (): string | null => {
    if (!videoRef.current || !canvasRef.current || !cameraReady) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setImageDimensions({ width: canvas.width, height: canvas.height });
    return canvas.toDataURL("image/jpeg", 0.92);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const img = new window.Image();
      img.onload = () => {
        // Draw to offscreen canvas to normalize dimensions & handle high-res photos
        const maxDim = 1600;
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const normalizedDataUrl = canvas.toDataURL("image/jpeg", 0.92);
          setImageDimensions({ width: w, height: h });
          setCapturedImageData(normalizedDataUrl);
          executeRecognition(normalizedDataUrl);
        } else {
          setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
          setCapturedImageData(dataUrl);
          executeRecognition(dataUrl);
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const executeRecognition = async (imgBase64?: string) => {
    const base64 = imgBase64 || captureFrame();
    if (!base64) return;
    if (!imgBase64) setCapturedImageData(base64);

    setCapturing(true);
    setServiceError("");

    try {
      const { data } = await api.post("/face/recognize", {
        imageBase64: base64,
        tolerance: 0.40,
        minFacePx: 35,
      });

      if (!data.face_count) {
        setServiceError("No face detected. Make sure faces are well lit and facing the camera, then try again.");
        return;
      }

      const all: FaceDetection[] = data.all_detections || [];
      setDetections(all);

      // Pre-select all recognized students
      const validIds = new Set<string>();
      (data.recognized || []).forEach((s: FaceDetection) => {
        validIds.add(s.student_id);
      });
      setSelectedStudentIds(validIds);
      setStep("result");
    } catch (e: any) {
      setServiceError(e.response?.data?.message || e.message || "Recognition error.");
    } finally {
      setCapturing(false);
    }
  };

  const toggleStudent = (studentId: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const commitAttendance = async () => {
    if (selectedStudentIds.size === 0) return;
    setMarking(true);
    setServiceError("");

    try {
      let response;
      try {
        response = await api.post(`/lessons/${lessonId}/batch-attendance`, {
          studentIds: Array.from(selectedStudentIds),
          status: "present",
        });
      } catch (err: any) {
        response = await api.post("/attendance/face-mark", {
          lessonId,
          studentIds: Array.from(selectedStudentIds),
        });
      }

      const count = response.data.markedCount || response.data.markedPresent || selectedStudentIds.size;
      setSuccessMsg(`Marked ${count} student(s) present.`);
      setStep("done");
    } catch (e: any) {
      setServiceError(e.response?.data?.message || "Failed to mark attendance.");
    } finally {
      setMarking(false);
    }
  };

  const recognizedList = detections.filter((d) => d.status === "recognized");
  const unknownList = detections.filter((d) => d.status === "unknown");

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          width: "100%",
          maxWidth: 720,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 60px -15px rgba(0,0,0,0.35)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            background: "#0f172a",
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Camera size={18} className="text-indigo-400" />
            <div>
              <div style={{ color: "#fff", fontSize: 15, fontWeight: 700 }}>Attendance</div>
              <div style={{ color: "#94a3b8", fontSize: 12 }}>{lessonTopic}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#94a3b8",
              padding: 4,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "20px", overflowY: "auto", flex: 1 }}>
          <canvas ref={canvasRef} style={{ display: "none" }} />

          {/* STEP 1: CAPTURE */}
          {step === "capture" && (
            <div>
              {/* Input Toggle */}
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginBottom: 14,
                  background: "#f1f5f9",
                  padding: 4,
                  borderRadius: 8,
                  width: "fit-content",
                }}
              >
                <button
                  onClick={() => setInputSource("camera")}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 6,
                    border: "none",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    background: inputSource === "camera" ? "#fff" : "transparent",
                    color: inputSource === "camera" ? "#0f172a" : "#64748b",
                    boxShadow: inputSource === "camera" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                  }}
                >
                  Camera
                </button>
                <button
                  onClick={() => setInputSource("upload")}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 6,
                    border: "none",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    background: inputSource === "upload" ? "#fff" : "transparent",
                    color: inputSource === "upload" ? "#0f172a" : "#64748b",
                    boxShadow: inputSource === "upload" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                  }}
                >
                  Upload Photo
                </button>
              </div>

              {/* Camera View */}
              {inputSource === "camera" && (
                <div>
                  {cameraError ? (
                    <div className="alert-strip alert-danger" style={{ marginBottom: 14 }}>
                      <strong>Camera Error:</strong> {cameraError}
                      <br />
                      <button
                        onClick={startCamera}
                        style={{
                          marginTop: 6,
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontWeight: 700,
                          color: "#991b1b",
                          fontSize: 12,
                          padding: 0,
                        }}
                      >
                        Retry
                      </button>
                    </div>
                  ) : (
                    <div
                      style={{
                        position: "relative",
                        background: "#000",
                        borderRadius: 8,
                        overflow: "hidden",
                        marginBottom: 16,
                      }}
                    >
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        style={{ width: "100%", display: "block", maxHeight: 380, objectFit: "cover" }}
                      />
                      {!cameraReady && (
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#fff",
                            fontSize: 13,
                            gap: 8,
                          }}
                        >
                          <Loader2 size={16} className="animate-spin" /> Starting camera...
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Upload View */}
              {inputSource === "upload" && (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: "2px dashed #cbd5e1",
                    borderRadius: 8,
                    padding: "40px 20px",
                    textAlign: "center",
                    cursor: "pointer",
                    background: "#f8fafc",
                    marginBottom: 16,
                  }}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/jpeg,image/png,image/webp"
                    style={{ display: "none" }}
                    onChange={handleFileUpload}
                  />
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      background: "#e0e7ff",
                      color: "#4f46e5",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "0 auto 10px auto",
                    }}
                  >
                    <Upload size={20} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", marginBottom: 2 }}>
                    Click to select a photo
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>JPG, PNG or WEBP</div>
                </div>
              )}

              {serviceError && (
                <div className="alert-strip alert-danger" style={{ marginBottom: 14, fontSize: 12 }}>
                  <AlertTriangle size={14} style={{ display: "inline", marginRight: 6 }} />
                  {serviceError}
                </div>
              )}

              {/* Buttons */}
              <div style={{ display: "flex", gap: 8 }}>
                {inputSource === "camera" && (
                  <button
                    onClick={() => executeRecognition()}
                    disabled={!cameraReady || capturing}
                    style={{
                      flex: 1,
                      background: cameraReady && !capturing ? "#4f46e5" : "#94a3b8",
                      color: "#fff",
                      border: "none",
                      borderRadius: 6,
                      padding: "10px 18px",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: cameraReady && !capturing ? "pointer" : "not-allowed",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    {capturing ? (
                      <>
                        <Loader2 size={15} className="animate-spin" /> Recognizing...
                      </>
                    ) : (
                      <>
                        <Camera size={15} /> Capture
                      </>
                    )}
                  </button>
                )}
                <button onClick={onClose} className="btn-secondary">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: RESULT */}
          {step === "result" && (
            <div>
              {/* Summary Cards */}
              <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                <div
                  style={{
                    flex: 1,
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    borderRadius: 6,
                    padding: "10px 14px",
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#166534", marginBottom: 2 }}>
                    Recognized
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#16a34a" }}>
                    {recognizedList.length}
                  </div>
                </div>

                <div
                  style={{
                    flex: 1,
                    background: "#fef9c3",
                    border: "1px solid #fde68a",
                    borderRadius: 6,
                    padding: "10px 14px",
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#854d0e", marginBottom: 2 }}>
                    Unregistered
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#d97706" }}>
                    {unknownList.length}
                  </div>
                </div>

                <div
                  style={{
                    flex: 1,
                    background: "#eef2ff",
                    border: "1px solid #c7d2fe",
                    borderRadius: 6,
                    padding: "10px 14px",
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#4338ca", marginBottom: 2 }}>
                    Selected
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#4f46e5" }}>
                    {selectedStudentIds.size}
                  </div>
                </div>
              </div>

              {/* Bounding Box Image Preview */}
              <div
                style={{
                  position: "relative",
                  background: "#000",
                  borderRadius: 8,
                  overflow: "hidden",
                  marginBottom: 16,
                  maxHeight: 360,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <img
                  src={capturedImageData}
                  alt="Capture"
                  style={{ width: "100%", display: "block", objectFit: "contain", maxHeight: 360 }}
                />

                <svg
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    pointerEvents: "none",
                  }}
                  viewBox={`0 0 ${imageDimensions.width} ${imageDimensions.height}`}
                  preserveAspectRatio="xMidYMid meet"
                >
                  {detections.map((f, i) => {
                    const { top, right, bottom, left } = f.bbox;
                    const w = right - left;
                    const h = bottom - top;
                    const isRec = f.status === "recognized";
                    const strokeColor = isRec ? "#22c55e" : "#f59e0b";
                    const fillColor = isRec ? "rgba(34, 197, 94, 0.15)" : "rgba(245, 158, 11, 0.15)";

                    return (
                      <g key={i}>
                        <rect
                          x={left}
                          y={top}
                          width={w}
                          height={h}
                          fill={fillColor}
                          stroke={strokeColor}
                          strokeWidth={2}
                          rx={3}
                        />
                        <rect
                          x={left}
                          y={Math.max(0, top - 22)}
                          width={Math.max(isRec ? 130 : 90, w)}
                          height={22}
                          fill={strokeColor}
                          rx={3}
                        />
                        <text
                          x={left + 6}
                          y={Math.max(0, top - 22) + 15}
                          fill="#ffffff"
                          fontSize={11}
                          fontFamily="sans-serif"
                          fontWeight="bold"
                        >
                          {isRec ? `${f.student_name} (${f.confidence}%)` : "Unregistered"}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Detected Students Roster */}
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#64748b",
                    marginBottom: 8,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Detected Students
                </div>

                <div
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 6,
                    overflow: "hidden",
                    maxHeight: 200,
                    overflowY: "auto",
                  }}
                >
                  {detections.length === 0 ? (
                    <div style={{ padding: 16, textAlign: "center", color: "#64748b", fontSize: 12 }}>
                      No faces detected in the image.
                    </div>
                  ) : (
                    detections.map((f, i) => {
                      const isRec = f.status === "recognized";
                      const isSelected = selectedStudentIds.has(f.student_id);

                      return (
                        <div
                          key={f.student_id + "-" + i}
                          onClick={() => {
                            if (isRec) toggleStudent(f.student_id);
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            padding: "10px 14px",
                            cursor: isRec ? "pointer" : "default",
                            borderBottom: i < detections.length - 1 ? "1px solid #f1f5f9" : "none",
                            background: isSelected ? "#f0fdf4" : "#fff",
                          }}
                        >
                          <div
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: 4,
                              border: isRec
                                ? isSelected
                                  ? "none"
                                  : "2px solid #d1d5db"
                                : "2px solid #e2e8f0",
                              background: isRec && isSelected ? "#16a34a" : "#fff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            {isSelected && isRec && <CheckCircle size={14} color="#fff" />}
                          </div>

                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
                              {f.student_name}
                            </div>
                            <div style={{ fontSize: 11, color: "#94a3b8" }}>
                              {isRec ? `ID: ${f.student_id}` : "Not in enrolled roster"}
                            </div>
                          </div>

                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: 4,
                              background: isRec ? "#dcfce7" : "#fef9c3",
                              color: isRec ? "#166534" : "#854d0e",
                            }}
                          >
                            {isRec ? `${f.confidence}% Match` : "Unregistered"}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {serviceError && (
                <div className="alert-strip alert-danger" style={{ marginBottom: 14, fontSize: 12 }}>
                  <AlertTriangle size={14} style={{ display: "inline", marginRight: 6 }} />
                  {serviceError}
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => {
                    setStep("capture");
                    setServiceError("");
                  }}
                  className="btn-secondary"
                >
                  <RotateCcw size={13} /> Retake
                </button>

                <button
                  onClick={commitAttendance}
                  disabled={selectedStudentIds.size === 0 || marking}
                  style={{
                    flex: 1,
                    background: selectedStudentIds.size > 0 && !marking ? "#16a34a" : "#94a3b8",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    padding: "10px 16px",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: selectedStudentIds.size > 0 && !marking ? "pointer" : "not-allowed",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  {marking ? (
                    <>
                      <Loader2 size={15} className="animate-spin" /> Marking...
                    </>
                  ) : (
                    <>
                      <Users size={14} /> Mark Present ({selectedStudentIds.size})
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: DONE */}
          {step === "done" && (
            <div style={{ textAlign: "center", padding: "28px 16px" }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "#dcfce7",
                  color: "#16a34a",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 14px auto",
                }}
              >
                <CheckCircle size={32} />
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>
                Attendance Recorded
              </div>
              <div style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>
                {successMsg}
              </div>
              <button
                onClick={onMarked}
                className="btn-primary"
                style={{ margin: "0 auto", padding: "8px 20px" }}
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
