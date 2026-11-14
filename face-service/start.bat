@echo off
echo Starting AcadAI Face Recognition Service...
cd /d %~dp0
if not exist venv (
    echo Creating virtual environment...
    python -m venv venv
)
call venv\Scripts\activate
pip install -r requirements.txt --quiet
python main.py
