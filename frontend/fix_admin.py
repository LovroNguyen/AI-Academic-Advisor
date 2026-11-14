with open("src/pages/AdminPage.tsx", "r", encoding="utf-8") as f:
    content = f.read()

bad  = "      const res = await fetch(${FACE_SERVICE}/register, {"
good = "      const res = await fetch(`${FACE_SERVICE}/register`, {"

if bad in content:
    content = content.replace(bad, good)
    with open("src/pages/AdminPage.tsx", "w", encoding="utf-8") as f:
        f.write(content)
    print("FIXED line 612")
else:
    print("NOT FOUND")
