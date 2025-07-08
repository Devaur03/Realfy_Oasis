# Posture Detection App

A full-stack web application for detecting bad posture during squats and desk sitting using rule-based analysis with MediaPipe.

## 🚀 Live Demo

- **Frontend**: [Vercel Deployment](https://realfy-oasis.vercel.app/)
- **Backend**: [Render Deployment](https://posture-backend-7wzn.onrender.com)
- **Demo Video**: [YouTube Link](https://www.youtube.com/watch?v=5RjlHWIvb6o)

## ✨ Features

- **Real-time Posture Analysis**
  - Webcam feed processing
  - Video upload capability
- **Rule-based Detection**
  - **Squats**:
    - Knee-toe alignment check
    - Back angle verification (>150°)
  - **Desk Sitting**:
    - Neck angle monitoring (<30°)
    - Shoulder-hip alignment
- **Visual Feedback**
  - Instant posture warnings
  - Detailed metrics display

## 🛠️ Tech Stack

| Component      | Technology                          |
| -------------- | ----------------------------------- |
| Frontend       | React, Lucide React                 |
| Backend        | Flask, MediaPipe, OpenCV            |
| Deployment     | Vercel (Frontend), Render (Backend) |
| Pose Detection | MediaPipe Pose                      |

## 📂 Project Structure

```
posture-app/
├── frontend/               # React application
│   ├── public/             # Static assets
│   ├── src/                # React components
│   │   ├── components/     # Reusable components
│   │   ├── pages/          # Page components
│   │   └── utils/          # Utility functions
│   ├── package.json        # Frontend dependencies
│   └── README.md           # Frontend documentation
├── backend/                # Flask application
│   ├── app.py              # Flask server
│   ├── posture_rules.py    # Rule-based detection logic
│   ├── requirements.txt    # Python dependencies
│   └── utils/              # Backend utilities
├── README.md               # This file
└── screenshot.png          # App screenshot
```

## 🖥️ Local Setup

### Prerequisites

- Node.js v16+ (Frontend)
- Python 3.9+ (Backend)
- Webcam for real-time testing

### Frontend Installation

```bash
cd frontend
npm install
npm start
```

The frontend will be available at `http://localhost:3000`

### Backend Installation

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

The backend will be available at `http://localhost:5000`

## 🎯 Key Implementation Details

### Rule-Based Logic

```python
# Example squat analysis (backend/posture_rules.py)
def analyze_squat(landmarks):
    """
    Analyze squat posture based on knee-toe alignment and back angle
    """
    # Knee-toe alignment check
    knee = landmarks[mp_pose.PoseLandmark.LEFT_KNEE]
    ankle = landmarks[mp_pose.PoseLandmark.LEFT_ANKLE]
    knee_over_toe = knee.x > ankle.x
  
    # Back angle verification
    shoulder = landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER]
    hip = landmarks[mp_pose.PoseLandmark.LEFT_HIP]
    back_angle = calculate_angle(shoulder, hip)
  
    return {
        'knee_alignment': knee_over_toe,
        'back_angle': back_angle,
        'good_posture': not knee_over_toe and back_angle > 150
    }
```

### MediaPipe Integration

```javascript
// Frontend frame capture (src/components/Webcam.js)
const captureFrame = () => {
  const canvas = canvasRef.current;
  const video = videoRef.current;
  
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);
  
  return canvas.toDataURL('image/jpeg', 0.8);
};

// Send frame to backend for analysis
const analyzePosture = async (frameData) => {
  const response = await fetch(`${API_URL}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: frameData, mode: 'squat' })
  });
  return response.json();
};
```

## 📌 Deployment Notes

### Frontend (Vercel)

1. Set environment variable:
   ```
   REACT_APP_API_URL=https://your-render-backend.onrender.com
   ```
2. Configure build settings:
   - Build command: `npm run build`
   - Output directory: `build`
   - Node.js version: `16.x`

### Backend (Render)

1. Required files:
   - `start.sh`:
     ```bash
     #!/bin/bash
     gunicorn --bind 0.0.0.0:$PORT app:app
     ```
2. Environment settings:
   - Python runtime: `3.9.13`
   - Build command: `pip install -r requirements.txt`
   - Start command: `./start.sh`

## ✅ Evaluation Criteria Checklist

- [X] Correct posture rules implementation
- [X] Clean, modular code structure
- [X] Fully deployed working application
- [X] Clear documentation with setup instructions
- [X] Explanatory demo video
- [X] Real-time webcam processing
- [X] Video upload capability
- [X] Visual feedback system

## 🔧 API Endpoints

### POST /analyze

Analyzes uploaded image/frame for posture detection

```json
{
  "image": "base64_encoded_image",
  "mode": "squat" | "sitting"
}
```

### GET /health

Health check endpoint for deployment monitoring

## 📚 Resources

- [MediaPipe Pose Documentation](https://google.github.io/mediapipe/solutions/pose)
- [React Webcam Documentation](https://www.npmjs.com/package/react-webcam)
- [Flask CORS Setup](https://flask-cors.readthedocs.io/)
- [Vercel Deployment Guide](https://vercel.com/docs)
- [Render Deployment Guide](https://render.com/docs)

## 🐛 Troubleshooting

### Common Issues

1. **Webcam not working**: Check browser permissions
2. **CORS errors**: Ensure backend CORS is configured properly
3. **Slow analysis**: Reduce frame capture frequency
4. **Deployment issues**: Check environment variables and build logs

### Performance Tips

- Use lower resolution for faster processing
- Implement frame skipping for real-time analysis
- Cache MediaPipe model loading

## 💡 Future Improvements

- Add user accounts to track posture history
- Implement more detailed skeletal visualization
- Add audio feedback for real-time correction
- Support for multiple exercise types
- Mobile app development
- Integration with fitness trackers

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👥 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

Developed for Realfy Oasis • [Devansh Gaur] • [08-07-2025]
