"""
Posture Detection API
A Flask-based backend service for analyzing human posture using MediaPipe.
Provides endpoints for frame analysis and health checks.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import mediapipe as mp
import math
import base64
from io import BytesIO
from PIL import Image
import logging

# Initialize Flask application with CORS support
app = Flask(__name__)
CORS(app)  # Enable Cross-Origin Resource Sharing for all routes

# Configure logging for better debugging and monitoring
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize MediaPipe Pose solution with optimal parameters
mp_pose = mp.solutions.pose
mp_drawing = mp.solutions.drawing_utils
pose = mp_pose.Pose(
    static_image_mode=False,      # Better for video streams
    model_complexity=1,          # Balanced accuracy and performance
    smooth_landmarks=True,       # Smoother landmark tracking
    min_detection_confidence=0.5,  # Minimum confidence to consider detection valid
    min_tracking_confidence=0.5    # Minimum confidence to continue tracking
)


class PostureAnalyzer:
    """Core posture analysis engine using MediaPipe pose detection."""
    
    def __init__(self):
        """Initialize with MediaPipe Pose instance."""
        self.pose = pose
        
    def calculate_angle(self, point1, point2, point3):
        """
        Calculate the angle between three points using vector math.
        
        Args:
            point1: First point (landmark)
            point2: Vertex point (landmark)
            point3: Third point (landmark)
            
        Returns:
            float: Angle in degrees between the points
        """
        try:
            # Convert landmarks to numpy arrays for vector operations
            a = np.array([point1.x, point1.y])
            b = np.array([point2.x, point2.y])
            c = np.array([point3.x, point3.y])
            
            # Calculate vectors from vertex point
            ba = a - b
            bc = c - b
            
            # Calculate cosine angle using dot product and magnitudes
            cosine_angle = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc))
            angle = np.arccos(np.clip(cosine_angle, -1.0, 1.0))
            
            return np.degrees(angle)
        except Exception as e:
            logger.warning(f"Angle calculation error: {e}")
            return 0  # Return 0 if calculation fails
    
    def analyze_desk_posture(self, landmarks):
        """
        Analyze posture for desk sitting scenarios.
        
        Detects:
        - Forward head posture (neck angle)
        - Slouching (shoulder-hip alignment)
        - Uneven shoulders
        
        Args:
            landmarks: MediaPipe pose landmarks
            
        Returns:
            tuple: (list of issues, dict of detailed measurements)
        """
        issues = []
        details = {}
        
        # Get relevant landmarks using MediaPipe's enum
        left_shoulder = landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER]
        right_shoulder = landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER]
        left_ear = landmarks[mp_pose.PoseLandmark.LEFT_EAR]
        right_ear = landmarks[mp_pose.PoseLandmark.RIGHT_EAR]
        left_hip = landmarks[mp_pose.PoseLandmark.LEFT_HIP]
        right_hip = landmarks[mp_pose.PoseLandmark.RIGHT_HIP]
        
        # Calculate average positions for symmetry analysis
        avg_shoulder = [
            (left_shoulder.x + right_shoulder.x) / 2,
            (left_shoulder.y + right_shoulder.y) / 2
        ]
        avg_ear = [
            (left_ear.x + right_ear.x) / 2,
            (left_ear.y + right_ear.y) / 2
        ]
        avg_hip = [
            (left_hip.x + right_hip.x) / 2,
            (left_hip.y + right_hip.y) / 2
        ]
        
        # Create point objects for angle calculation
        ear_point = type('Point', (), {'x': avg_ear[0], 'y': avg_ear[1]})()
        shoulder_point = type('Point', (), {'x': avg_shoulder[0], 'y': avg_shoulder[1]})()
        hip_point = type('Point', (), {'x': avg_hip[0], 'y': avg_hip[1]})()
        
        # Neck angle analysis (forward head posture)
        neck_angle = self.calculate_angle(ear_point, shoulder_point, hip_point)
        details['neck_angle'] = neck_angle
        
        # Posture thresholds based on ergonomic studies
        if neck_angle < 150:  # Ideal is ~180° (straight alignment)
            issues.append("Forward head posture detected")
        
        # Shoulder-hip alignment (slouching detection)
        shoulder_hip_horizontal_diff = abs(avg_shoulder[0] - avg_hip[0])
        if shoulder_hip_horizontal_diff > 0.1:  # Threshold for significant slouching
            issues.append("Slouching detected")
        
        # Shoulder level check (uneven shoulders)
        shoulder_level_diff = abs(left_shoulder.y - right_shoulder.y)
        if shoulder_level_diff > 0.05:  # Threshold for noticeable unevenness
            issues.append("Uneven shoulders")
        
        # Additional metrics for detailed feedback
        details['back_angle'] = 180 - neck_angle  # Complementary angle
        details['shoulder_alignment'] = shoulder_hip_horizontal_diff < 0.1
        
        return issues, details
    
    def analyze_squat_posture(self, landmarks):
        """
        Analyze posture for squat exercises.
        
        Detects:
        - Knees extending beyond toes
        - Rounded back
        - Poor knee tracking
        
        Args:
            landmarks: MediaPipe pose landmarks
            
        Returns:
            tuple: (list of issues, dict of detailed measurements)
        """
        issues = []
        details = {}
        
        # Get lower body landmarks
        left_knee = landmarks[mp_pose.PoseLandmark.LEFT_KNEE]
        right_knee = landmarks[mp_pose.PoseLandmark.RIGHT_KNEE]
        left_ankle = landmarks[mp_pose.PoseLandmark.LEFT_ANKLE]
        right_ankle = landmarks[mp_pose.PoseLandmark.RIGHT_ANKLE]
        left_hip = landmarks[mp_pose.PoseLandmark.LEFT_HIP]
        right_hip = landmarks[mp_pose.PoseLandmark.RIGHT_HIP]
        left_shoulder = landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER]
        right_shoulder = landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER]
        
        # Knee-toe alignment check (proper squat form)
        left_knee_over_toe = left_knee.x > left_ankle.x
        right_knee_over_toe = right_knee.x > right_ankle.x
        
        if left_knee_over_toe or right_knee_over_toe:
            issues.append("Knees extending beyond toes")
        
        details['knee_toe_alignment'] = not (left_knee_over_toe or right_knee_over_toe)
        
        # Back angle analysis (prevent rounded back)
        back_angle = self.calculate_angle(
            left_shoulder, left_hip, left_knee
        )
        details['back_angle'] = back_angle
        
        if back_angle < 150:  # Threshold for proper back alignment
            issues.append("Rounded back detected")
        
        # Knee tracking (alignment during movement)
        knee_tracking_left = abs(left_knee.x - left_ankle.x) < 0.1
        knee_tracking_right = abs(right_knee.x - right_ankle.x) < 0.1
        
        if not (knee_tracking_left and knee_tracking_right):
            issues.append("Poor knee tracking")
        
        details['knee_tracking'] = knee_tracking_left and knee_tracking_right
        
        return issues, details
    
    def detect_exercise_type(self, landmarks):
        """
        Determine whether the subject is performing squats or desk sitting.
        
        Args:
            landmarks: MediaPipe pose landmarks
            
        Returns:
            str: 'squat' or 'desk_sitting'
        """
        left_knee = landmarks[mp_pose.PoseLandmark.LEFT_KNEE]
        right_knee = landmarks[mp_pose.PoseLandmark.RIGHT_KNEE]
        left_hip = landmarks[mp_pose.PoseLandmark.LEFT_HIP]
        right_hip = landmarks[mp_pose.PoseLandmark.RIGHT_HIP]
        
        # Calculate knee-hip angle to determine body position
        knee_hip_angle = self.calculate_angle(
            left_knee, left_hip, right_hip
        )
        
        # Classification based on angle thresholds
        return "squat" if knee_hip_angle < 120 else "desk_sitting"
    
    def analyze_frame(self, image):
        """
        Main analysis pipeline for processing a single frame.
        
        Args:
            image: Input image (PIL Image or file-like object)
            
        Returns:
            dict: Analysis results including posture assessment and metrics
        """
        try:
            # Convert PIL Image to OpenCV format if needed
            if isinstance(image, Image.Image):
                image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
            
            # MediaPipe requires RGB format
            rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            
            # Process image with MediaPipe Pose
            results = self.pose.process(rgb_image)
            
            # Early return if no person detected
            if not results.pose_landmarks:
                return {
                    'is_bad_posture': False,
                    'message': 'No person detected in frame',
                    'confidence': 0.0,
                    'details': {}
                }
            
            landmarks = results.pose_landmarks.landmark
            
            # Determine exercise type and analyze accordingly
            exercise_type = self.detect_exercise_type(landmarks)
            
            if exercise_type == "squat":
                issues, details = self.analyze_squat_posture(landmarks)
            else:
                issues, details = self.analyze_desk_posture(landmarks)
            
            # Compose results
            is_bad_posture = len(issues) > 0
            message = (
                f"Bad posture detected: {', '.join(issues)}" if is_bad_posture
                else f"Good {exercise_type.replace('_', ' ')} posture!"
            )
            
            # Confidence calculation based on number of issues
            confidence = max(0.5, 1.0 - (len(issues) * 0.2))  # Minimum 50% confidence
            
            return {
                'is_bad_posture': is_bad_posture,
                'message': message,
                'confidence': confidence,
                'exercise_type': exercise_type,
                'details': details,
                'issues': issues
            }
            
        except Exception as e:
            logger.error(f"Frame analysis error: {str(e)}", exc_info=True)
            return {
                'is_bad_posture': False,
                'message': f'Analysis error: {str(e)}',
                'confidence': 0.0,
                'details': {}
            }


# Initialize the analyzer instance
analyzer = PostureAnalyzer()


@app.route('/', methods=['GET'])
def health_check():
    """Health check endpoint for service monitoring."""
    return jsonify({
        'status': 'healthy',
        'message': 'Posture Detection API is running',
        'endpoints': {
            'analyze': '/analyze (POST)',
            'health': '/ (GET)'
        }
    })


@app.route('/analyze', methods=['POST'])
def analyze_posture():
    """
    API endpoint for posture analysis.
    
    Accepts an image file ('frame') and returns posture analysis.
    
    Returns:
        JSON: Analysis results or error message
    """
    try:
        # Validate request contains an image file
        if 'frame' not in request.files:
            logger.warning("No frame provided in request")
            return jsonify({'error': 'No frame provided'}), 400
        
        frame_file = request.files['frame']
        
        # Read and convert image
        image_bytes = frame_file.read()
        image = Image.open(BytesIO(image_bytes))
        
        # Perform analysis
        result = analyzer.analyze_frame(image)
        logger.info(f"Analysis completed: {result.get('message')}")
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Analysis endpoint error: {str(e)}", exc_info=True)
        return jsonify({
            'error': str(e),
            'is_bad_posture': False,
            'message': 'Analysis failed',
            'confidence': 0.0
        }), 500


@app.route('/test', methods=['GET'])
def test_endpoint():
    """Test endpoint for verification and demonstration."""
    return jsonify({
        'status': 'success',
        'message': 'API is working correctly',
        'test_analysis': {
            'is_bad_posture': True,
            'message': 'This is a test response',
            'confidence': 0.85,
            'details': {
                'neck_angle': 25.5,
                'back_angle': 160.2,
                'knee_toe_alignment': True
            }
        }
    })


if __name__ == '__main__':
    # Start the Flask development server
    app.run(
        debug=True,      # Enable debug mode for development
        host='0.0.0.0',  # Make accessible on all network interfaces
        port=5000        # Standard Flask port
    )