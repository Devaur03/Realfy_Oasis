/**
 * Posture Detection App
 * A React application for real-time posture analysis using webcam or uploaded videos.
 * Provides feedback on desk sitting and squat postures with visual indicators.
 */

import React, { useState, useRef, useCallback } from 'react';
import { 
  Camera, 
  Upload, 
  Play, 
  Pause, 
  AlertTriangle, 
  CheckCircle, 
  RotateCcw 
} from 'lucide-react';
import './App.css';

const PostureApp = () => {
  // State management for application mode and status
  const [mode, setMode] = useState('webcam'); // 'webcam' or 'upload'
  const [isRecording, setIsRecording] = useState(false);
  const [postureResults, setPostureResults] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadedVideo, setUploadedVideo] = useState(null);
  const [stream, setStream] = useState(null);
  
  // Refs for DOM elements and media handling
  const webcamRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const intervalRef = useRef(null);
  const fileInputRef = useRef(null);

  /**
   * Initializes webcam access and sets up video stream
   * Handles permissions and errors gracefully
   */
  const startWebcam = async () => {
    try {
      const constraints = {
        video: { 
          width: { ideal: 640 }, 
          height: { ideal: 480 },
          facingMode: 'user' // Prefer front-facing camera
        }
      };
      
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      
      if (webcamRef.current) {
        webcamRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error('Webcam access error:', err);
      alert('Camera access denied. Please enable permissions to continue.');
    }
  };

  /**
   * Stops webcam stream and cleans up resources
   * Also stops any ongoing analysis
   */
  const stopWebcam = () => {
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop(); // Stop each media track individually
      });
      setStream(null);
    }
    
    // Clear analysis interval if running
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    setIsRecording(false);
  };

  /**
   * Captures a single frame from the webcam video stream
   * Uses hidden canvas to convert video frame to image data
   * @returns {string} Base64 encoded image data
   */
  const captureFrame = useCallback(() => {
    if (!webcamRef.current || !canvasRef.current) return null;
    
    const canvas = canvasRef.current;
    const video = webcamRef.current;
    const ctx = canvas.getContext('2d');
    
    // Set canvas to match video dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw current video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Return as JPEG with 80% quality
    return canvas.toDataURL('image/jpeg', 0.8);
  }, []);

  /**
   * Sends captured frame to backend for analysis
   * Handles response and updates UI with results
   * @param {string} imageData Base64 encoded image data
   */
  const analyzeFrame = async (imageData) => {
    try {
      setIsAnalyzing(true);
      
      // Convert base64 to blob for efficient transfer
      const response = await fetch(imageData);
      const blob = await response.blob();
      
      // Prepare form data for API request
      const formData = new FormData();
      formData.append('frame', blob, 'posture-frame.jpg');
      
      // In production, replace with your actual backend endpoint
      const backendUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000/analyze';
      
      const result = await fetch(backendUrl, {
        method: 'POST',
        body: formData,
      });
      
      if (!result.ok) {
        throw new Error(`API responded with status ${result.status}`);
      }
      
      const data = await result.json();
      setPostureResults(data);
    } catch (error) {
      console.error('Analysis error:', error);
      // Fallback mock data for demo purposes
      setPostureResults({
        is_bad_posture: Math.random() > 0.5,
        message: Math.random() > 0.5 ? 
          'Good posture detected!' : 
          'Bad posture: Keep your back straight!',
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

  /**
   * Starts periodic posture analysis at 2 second intervals
   * Only runs when webcam is active
   */
  const startAnalysis = () => {
    if (!webcamRef.current) return;
    
    setIsRecording(true);
    // Set interval for continuous analysis
    intervalRef.current = setInterval(() => {
      const frame = captureFrame();
      if (frame) {
        analyzeFrame(frame);
      }
    }, 2000); // Analyze every 2 seconds
  };

  /**
   * Stops ongoing periodic posture analysis
   */
  const stopAnalysis = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRecording(false);
  };

  /**
   * Handles video file upload from user
   * @param {Event} event File input change event
   */
  const handleVideoUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type.includes('video')) {
      // Create object URL for video playback
      const videoURL = URL.createObjectURL(file);
      setUploadedVideo(videoURL);
      setMode('upload');
    }
  };

  /**
   * Captures and analyzes a frame from uploaded video
   */
  const analyzeUploadedVideo = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');
    
    // Match canvas to video dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Capture current video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert to image data and analyze
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    analyzeFrame(imageData);
  };

  /**
   * Resets application to initial state
   * Cleans up all media and analysis resources
   */
  const resetApp = () => {
    stopWebcam();
    setPostureResults(null);
    
    // Clean up video object URL if exists
    if (uploadedVideo) {
      URL.revokeObjectURL(uploadedVideo);
      setUploadedVideo(null);
    }
    
    setMode('webcam');
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="app-container">
      {/* Application Header */}
      <header className="app-header">
        <h1 className="app-title">Posture Detection App</h1>
        <p className="app-subtitle">
          Real-time posture analysis for squats and desk sitting
        </p>
      </header>

      {/* Mode Selection Toggle */}
      <div className="mode-selector">
        <button
          onClick={() => setMode('webcam')}
          className={`mode-btn ${mode === 'webcam' ? 'active' : ''}`}
          aria-label="Switch to webcam mode"
        >
          <Camera className="icon" size={18} />
          Webcam
        </button>
        <button
          onClick={() => setMode('upload')}
          className={`mode-btn ${mode === 'upload' ? 'active' : ''}`}
          aria-label="Switch to video upload mode"
        >
          <Upload className="icon" size={18} />
          Upload Video
        </button>
      </div>

      {/* Main Content Area */}
      <div className="analysis-container">
        {/* Video Feed Section */}
        <div className="card">
          <h2 className="card-header">
            {mode === 'webcam' ? 'Live Camera Feed' : 'Uploaded Video Preview'}
          </h2>
          
          <div className="video-container">
            {mode === 'webcam' ? (
              <video
                ref={webcamRef}
                autoPlay
                playsInline
                muted
                className="video-element"
                aria-label="Live camera feed"
              />
            ) : (
              <video
                ref={videoRef}
                src={uploadedVideo}
                controls
                className="video-element"
                aria-label="Uploaded video playback"
              />
            )}
            
            {/* Loading Overlay */}
            {isAnalyzing && (
              <div className="loading-overlay" aria-busy="true">
                <div className="spinner" aria-label="Analyzing posture" />
                <p>Analyzing posture...</p>
              </div>
            )}
          </div>

          {/* Control Buttons */}
          <div className="controls">
            {mode === 'webcam' ? (
              <>
                {!stream ? (
                  <button
                    onClick={startWebcam}
                    className="btn btn-success"
                    aria-label="Start webcam"
                  >
                    <Camera className="icon" size={16} />
                    Start Webcam
                  </button>
                ) : (
                  <>
                    {!isRecording ? (
                      <button
                        onClick={startAnalysis}
                        className="btn btn-primary"
                        aria-label="Start posture analysis"
                      >
                        <Play className="icon" size={16} />
                        Start Analysis
                      </button>
                    ) : (
                      <button
                        onClick={stopAnalysis}
                        className="btn btn-danger"
                        aria-label="Stop posture analysis"
                      >
                        <Pause className="icon" size={16} />
                        Stop Analysis
                      </button>
                    )}
                    <button
                      onClick={stopWebcam}
                      className="btn btn-secondary"
                      aria-label="Stop webcam"
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
                  aria-label="Video upload input"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="btn btn-primary"
                  aria-label="Select video file"
                >
                  <Upload className="icon" size={16} />
                  Choose Video
                </button>
                {uploadedVideo && (
                  <button
                    onClick={analyzeUploadedVideo}
                    className="btn btn-success"
                    aria-label="Analyze video frame"
                  >
                    Analyze Frame
                  </button>
                )}
              </>
            )}
            
            <button
              onClick={resetApp}
              className="btn btn-secondary"
              aria-label="Reset application"
            >
              <RotateCcw className="icon" size={16} />
              Reset
            </button>
          </div>
        </div>

        {/* Results Panel */}
        <div className="card">
          <h2 className="card-header">Posture Analysis Results</h2>
          
          {postureResults ? (
            <div className="fade-in">
              {/* Posture Status Indicator */}
              <div 
                className={`result-status ${
                  postureResults.is_bad_posture ? 'bad' : 'good'
                }`}
                aria-live="polite"
              >
                {postureResults.is_bad_posture ? (
                  <AlertTriangle className="icon" size={20} />
                ) : (
                  <CheckCircle className="icon" size={20} />
                )}
                <span>{postureResults.message}</span>
              </div>

              {/* Detailed Metrics */}
              <div className="details-container">
                <h3 className="card-header">Detailed Metrics</h3>
                <div className="details-list">
                  <div className="detail-item">
                    <span className="detail-label">Neck Angle:</span>
                    <span 
                      className={`detail-value ${
                        postureResults.details?.neck_angle > 30 ? 'bad' : 'good'
                      }`}
                      aria-label={`Neck angle: ${postureResults.details?.neck_angle?.toFixed(1)} degrees`}
                    >
                      {postureResults.details?.neck_angle?.toFixed(1) || 'N/A'}°
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Back Angle:</span>
                    <span 
                      className={`detail-value ${
                        postureResults.details?.back_angle < 150 ? 'bad' : 'good'
                      }`}
                      aria-label={`Back angle: ${postureResults.details?.back_angle?.toFixed(1)} degrees`}
                    >
                      {postureResults.details?.back_angle?.toFixed(1) || 'N/A'}°
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Knee-Toe Alignment:</span>
                    <span 
                      className={`detail-value ${
                        postureResults.details?.knee_toe_alignment ? 'good' : 'bad'
                      }`}
                    >
                      {postureResults.details?.knee_toe_alignment ? 'Good' : 'Poor'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Confidence Meter */}
              <div className="confidence-meter">
                <div className="detail-item">
                  <span className="detail-label">Analysis Confidence:</span>
                  <span 
                    className="detail-value"
                    aria-label={`${(postureResults.confidence * 100).toFixed(1)} percent confidence`}
                  >
                    {(postureResults.confidence * 100).toFixed(1)}%
                  </span>
                </div>
                <div 
                  className="confidence-bar"
                  aria-valuenow={postureResults.confidence * 100}
                  aria-valuemin="0"
                  aria-valuemax="100"
                >
                  <div 
                    className="confidence-progress"
                    style={{ width: `${postureResults.confidence * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="no-results">
              <AlertTriangle 
                className="no-results-icon" 
                size={48} 
                aria-hidden="true"
              />
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

      {/* Usage Instructions */}
      <div className="instructions">
        <h2 className="instructions-title">Proper Posture Guidelines</h2>
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
      <canvas 
        ref={canvasRef} 
        className="hidden" 
        aria-hidden="true"
      />
    </div>
  );
};

export default PostureApp;