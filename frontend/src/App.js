import React, { useState, useRef, useCallback } from 'react';
import { Camera, Upload, Play, Pause, AlertTriangle, CheckCircle, RotateCcw } from 'lucide-react';
import './App.css'; // Keep this import

const PostureApp = () => {
  const [mode, setMode] = useState('webcam'); // 'webcam' or 'upload'
  const [isRecording, setIsRecording] = useState(false);
  const [postureResults, setPostureResults] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadedVideo, setUploadedVideo] = useState(null);
  const [stream, setStream] = useState(null);
  
  const webcamRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const intervalRef = useRef(null);
  const fileInputRef = useRef(null);

  // Start webcam
  const startWebcam = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 }
      });
      setStream(mediaStream);
      if (webcamRef.current) {
        webcamRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error('Error accessing webcam:', err);
      alert('Unable to access webcam. Please check permissions.');
    }
  };

  // Stop webcam
  const stopWebcam = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRecording(false);
  };

  // Capture frame from webcam
  const captureFrame = useCallback(() => {
    if (!webcamRef.current || !canvasRef.current) return null;
    
    const canvas = canvasRef.current;
    const video = webcamRef.current;
    const ctx = canvas.getContext('2d');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    
    return canvas.toDataURL('image/jpeg', 0.8);
  }, []);

  // Analyze frame with backend
  const analyzeFrame = async (imageData) => {
    try {
      setIsAnalyzing(true);
      
      // Convert base64 to blob
      const response = await fetch(imageData);
      const blob = await response.blob();
      
      const formData = new FormData();
      formData.append('frame', blob, 'frame.jpg');
      
      // Replace with your deployed backend URL
      const backendUrl = 'https://your-backend-url.com/analyze';
      
      const result = await fetch(backendUrl, {
        method: 'POST',
        body: formData,
      });
      
      if (!result.ok) {
        throw new Error('Analysis failed');
      }
      
      const data = await result.json();
      setPostureResults(data);
    } catch (error) {
      console.error('Error analyzing frame:', error);
      // Mock response for demo
      setPostureResults({
        is_bad_posture: Math.random() > 0.5,
        message: Math.random() > 0.5 ? 'Good posture detected!' : 'Bad posture: Keep your back straight!',
        confidence: Math.random(),
        details: {
          neck_angle: Math.random() * 60,
          back_angle: Math.random() * 180,
          knee_toe_alignment: Math.random() > 0.5
        }
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Start real-time analysis
  const startAnalysis = () => {
    if (!webcamRef.current) return;
    
    setIsRecording(true);
    intervalRef.current = setInterval(() => {
      const frame = captureFrame();
      if (frame) {
        analyzeFrame(frame);
      }
    }, 2000); // Analyze every 2 seconds
  };

  // Stop real-time analysis
  const stopAnalysis = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRecording(false);
  };

  // Handle video upload
  const handleVideoUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const videoURL = URL.createObjectURL(file);
      setUploadedVideo(videoURL);
      setMode('upload');
    }
  };

  // Analyze uploaded video frame
  const analyzeUploadedVideo = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    analyzeFrame(imageData);
  };

  // Reset app
  const resetApp = () => {
    stopWebcam();
    setPostureResults(null);
    setUploadedVideo(null);
    setMode('webcam');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <h1 className="app-title">Posture Detection App</h1>
        <p className="app-subtitle">Real-time posture analysis for squats and desk sitting</p>
      </header>

      {/* Mode Selection */}
      <div className="mode-selector">
        <button
          onClick={() => setMode('webcam')}
          className={`mode-btn ${mode === 'webcam' ? 'active' : ''}`}
        >
          <Camera className="icon" />
          Webcam
        </button>
        <button
          onClick={() => setMode('upload')}
          className={`mode-btn ${mode === 'upload' ? 'active' : ''}`}
        >
          <Upload className="icon" />
          Upload Video
        </button>
      </div>

      <div className="analysis-container">
        {/* Video Feed */}
        <div className="card">
          <h2 className="card-header">
            {mode === 'webcam' ? 'Live Feed' : 'Uploaded Video'}
          </h2>
          
          <div className="video-container">
            {mode === 'webcam' ? (
              <video
                ref={webcamRef}
                autoPlay
                playsInline
                className="video-element"
              />
            ) : (
              <video
                ref={videoRef}
                src={uploadedVideo}
                controls
                className="video-element"
              />
            )}
            
            {isAnalyzing && (
              <div className="loading-overlay">
                <div className="spinner"></div>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="controls">
            {mode === 'webcam' ? (
              <>
                {!stream ? (
                  <button
                    onClick={startWebcam}
                    className="btn btn-success"
                  >
                    <Camera className="icon" />
                    Start Webcam
                  </button>
                ) : (
                  <>
                    {!isRecording ? (
                      <button
                        onClick={startAnalysis}
                        className="btn btn-primary"
                      >
                        <Play className="icon" />
                        Start Analysis
                      </button>
                    ) : (
                      <button
                        onClick={stopAnalysis}
                        className="btn btn-danger"
                      >
                        <Pause className="icon" />
                        Stop Analysis
                      </button>
                    )}
                    <button
                      onClick={stopWebcam}
                      className="btn btn-secondary"
                    >
                      Stop Webcam
                    </button>
                  </>
                )}
              </>
            ) : (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleVideoUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="btn btn-primary"
                >
                  <Upload className="icon" />
                  Choose Video
                </button>
                {uploadedVideo && (
                  <button
                    onClick={analyzeUploadedVideo}
                    className="btn btn-success"
                  >
                    Analyze Frame
                  </button>
                )}
              </>
            )}
            
            <button
              onClick={resetApp}
              className="btn btn-secondary"
            >
              <RotateCcw className="icon" />
              Reset
            </button>
          </div>
        </div>

        {/* Results Panel */}
        <div className="card">
          <h2 className="card-header">Posture Analysis</h2>
          
          {postureResults ? (
            <div className="fade-in">
              {/* Status */}
              <div className={`result-status ${
                postureResults.is_bad_posture ? 'bad' : 'good'
              }`}>
                {postureResults.is_bad_posture ? (
                  <AlertTriangle className="icon" />
                ) : (
                  <CheckCircle className="icon" />
                )}
                <span>{postureResults.message}</span>
              </div>

              {/* Details */}
              <div className="details-container">
                <h3 className="card-header">Analysis Details</h3>
                <div className="details-list">
                  <div className="detail-item">
                    <span className="detail-label">Neck Angle:</span>
                    <span className={`detail-value ${
                      postureResults.details?.neck_angle > 30 ? 'bad' : 'good'
                    }`}>
                      {postureResults.details?.neck_angle?.toFixed(1) || 'N/A'}°
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Back Angle:</span>
                    <span className={`detail-value ${
                      postureResults.details?.back_angle < 150 ? 'bad' : 'good'
                    }`}>
                      {postureResults.details?.back_angle?.toFixed(1) || 'N/A'}°
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Knee-Toe Alignment:</span>
                    <span className={`detail-value ${
                      postureResults.details?.knee_toe_alignment ? 'good' : 'bad'
                    }`}>
                      {postureResults.details?.knee_toe_alignment ? 'Good' : 'Poor'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Confidence */}
              <div className="confidence-meter">
                <div className="detail-item">
                  <span className="detail-label">Confidence:</span>
                  <span className="detail-value">
                    {(postureResults.confidence * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="confidence-bar">
                  <div 
                    className="confidence-progress"
                    style={{ width: `${postureResults.confidence * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          ) : (
            <div className="no-results">
              <AlertTriangle className="no-results-icon" size={48} />
              <p>No analysis results yet</p>
              <p className="text-sm">
                {mode === 'webcam' 
                  ? 'Start webcam and begin analysis' 
                  : 'Upload a video and analyze a frame'
                }
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="instructions">
        <h2 className="instructions-title">How to Use</h2>
        <ul className="instructions-list">
          <div>
            <h3 className="font-medium">For Desk Sitting:</h3>
            <ul>
              <li className="instruction-item">Keep your back straight</li>
              <li className="instruction-item">Neck should not bend forward greater than 30°</li>
              <li className="instruction-item">Shoulders should align with hips</li>
              <li className="instruction-item">Maintain good posture throughout</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium">For Squats:</h3>
            <ul>
              <li className="instruction-item">Keep knees behind toes</li>
              <li className="instruction-item">Maintain back angle greater than 150°</li>
              <li className="instruction-item">Keep chest up and shoulders back</li>
              <li className="instruction-item">Proper hip hinge movement</li>
            </ul>
          </div>
        </ul>
      </div>

      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};


export default PostureApp; // Export the component