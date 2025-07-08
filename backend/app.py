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

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize MediaPipe
mp_pose = mp.solutions.pose
mp_drawing = mp.solutions.drawing_utils
pose = mp_pose.Pose(
    static_image_mode=False,
    model_complexity=1,
    smooth_landmarks=True,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)

class PostureAnalyzer:
    def __init__(self):
        self.pose = pose
        
    def calculate_angle(self, point1, point2, point3):
        """Calculate angle between three points"""
        try:
            # Convert to numpy arrays
            a = np.array([point1.x, point1.y])
            b = np.array([point2.x, point2.y])
            c = np.array([point3.x, point3.y])
            
            # Calculate vectors
            ba = a - b
            bc = c - b
            
            # Calculate angle
            cosine_angle = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc))
            angle = np.arccos(np.clip(cosine_angle, -1.0, 1.0))
            
            return np.degrees(angle)
        except:
            return 0
    
    def analyze_desk_posture(self, landmarks):
        """Analyze desk sitting posture"""
        issues = []
        details = {}
        
        # Get key landmarks
        left_shoulder = landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER]
        right_shoulder = landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER]
        left_ear = landmarks[mp_pose.PoseLandmark.LEFT_EAR]
        right_ear = landmarks[mp_pose.PoseLandmark.RIGHT_EAR]
        left_hip = landmarks[mp_pose.PoseLandmark.LEFT_HIP]
        right_hip = landmarks[mp_pose.PoseLandmark.RIGHT_HIP]
        
        # Calculate average positions
        avg_shoulder = [(left_shoulder.x + right_shoulder.x) / 2, 
                       (left_shoulder.y + right_shoulder.y) / 2]
        avg_ear = [(left_ear.x + right_ear.x) / 2, 
                  (left_ear.y + right_ear.y) / 2]
        avg_hip = [(left_hip.x + right_hip.x) / 2, 
                  (left_hip.y + right_hip.y) / 2]
        
        # Check neck angle (forward head posture)
        neck_angle = self.calculate_angle(
            type('Point', (), {'x': avg_ear[0], 'y': avg_ear[1]})(),
            type('Point', (), {'x': avg_shoulder[0], 'y': avg_shoulder[1]})(),
            type('Point', (), {'x': avg_hip[0], 'y': avg_hip[1]})()
        )
        details['neck_angle'] = neck_angle
        
        # Check if neck is bent forward too much
        if neck_angle < 150:  # Less than 150 degrees indicates forward head
            issues.append("Forward head posture detected")
        
        # Check back alignment (shoulder-hip vertical alignment)
        shoulder_hip_horizontal_diff = abs(avg_shoulder[0] - avg_hip[0])
        if shoulder_hip_horizontal_diff > 0.1:  # Threshold for slouching
            issues.append("Slouching detected")
        
        # Check shoulder level
        shoulder_level_diff = abs(left_shoulder.y - right_shoulder.y)
        if shoulder_level_diff > 0.05:  # Threshold for uneven shoulders
            issues.append("Uneven shoulders")
        
        details['back_angle'] = 180 - neck_angle  # Approximate back angle
        details['shoulder_alignment'] = shoulder_hip_horizontal_diff < 0.1
        
        return issues, details
    
    def analyze_squat_posture(self, landmarks):
        """Analyze squat posture"""
        issues = []
        details = {}
        
        # Get key landmarks
        left_knee = landmarks[mp_pose.PoseLandmark.LEFT_KNEE]
        right_knee = landmarks[mp_pose.PoseLandmark.RIGHT_KNEE]
        left_ankle = landmarks[mp_pose.PoseLandmark.LEFT_ANKLE]
        right_ankle = landmarks[mp_pose.PoseLandmark.RIGHT_ANKLE]
        left_hip = landmarks[mp_pose.PoseLandmark.LEFT_HIP]
        right_hip = landmarks[mp_pose.PoseLandmark.RIGHT_HIP]
        left_shoulder = landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER]
        right_shoulder = landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER]
        
        # Check knee-toe alignment (knees shouldn't go beyond toes)
        left_knee_over_toe = left_knee.x > left_ankle.x
        right_knee_over_toe = right_knee.x > right_ankle.x
        
        if left_knee_over_toe or right_knee_over_toe:
            issues.append("Knees extending beyond toes")
        
        details['knee_toe_alignment'] = not (left_knee_over_toe or right_knee_over_toe)
        
        # Check back angle (should maintain relatively straight back)
        back_angle = self.calculate_angle(
            left_shoulder, left_hip, left_knee
        )
        details['back_angle'] = back_angle
        
        if back_angle < 150:  # Back is too rounded
            issues.append("Rounded back detected")
        
        # Check knee tracking (knees should track in line with toes)
        knee_tracking_left = abs(left_knee.x - left_ankle.x) < 0.1
        knee_tracking_right = abs(right_knee.x - right_ankle.x) < 0.1
        
        if not (knee_tracking_left and knee_tracking_right):
            issues.append("Poor knee tracking")
        
        details['knee_tracking'] = knee_tracking_left and knee_tracking_right
        
        return issues, details
    
    def detect_exercise_type(self, landmarks):
        """Detect if person is doing squats or desk sitting"""
        left_knee = landmarks[mp_pose.PoseLandmark.LEFT_KNEE]
        right_knee = landmarks[mp_pose.PoseLandmark.RIGHT_KNEE]
        left_hip = landmarks[mp_pose.PoseLandmark.LEFT_HIP]
        right_hip = landmarks[mp_pose.PoseLandmark.RIGHT_HIP]
        
        # Calculate knee-hip angle to determine position
        knee_hip_angle = self.calculate_angle(
            left_knee, left_hip, right_hip
        )
        
        # If knees are significantly bent, likely squatting
        if knee_hip_angle < 120:
            return "squat"
        else:
            return "desk_sitting"
    
    def analyze_frame(self, image):
        """Main analysis function"""
        try:
            # Convert PIL image to CV2 format
            if isinstance(image, Image.Image):
                image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
            
            # Convert BGR to RGB for MediaPipe
            rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            
            # Process the image
            results = self.pose.process(rgb_image)
            
            if not results.pose_landmarks:
                return {
                    'is_bad_posture': False,
                    'message': 'No person detected in frame',
                    'confidence': 0.0,
                    'details': {}
                }
            
            landmarks = results.pose_landmarks.landmark
            
            # Detect exercise type
            exercise_type = self.detect_exercise_type(landmarks)
            
            # Analyze based on exercise type
            if exercise_type == "squat":
                issues, details = self.analyze_squat_posture(landmarks)
            else:
                issues, details = self.analyze_desk_posture(landmarks)
            
            # Determine if posture is bad
            is_bad_posture = len(issues) > 0
            
            # Create response message
            if is_bad_posture:
                message = f"Bad posture detected: {', '.join(issues)}"
            else:
                message = f"Good {exercise_type.replace('_', ' ')} posture!"
            
            # Calculate confidence (simplified)
            confidence = max(0.5, 1.0 - (len(issues) * 0.2))
            
            return {
                'is_bad_posture': is_bad_posture,
                'message': message,
                'confidence': confidence,
                'exercise_type': exercise_type,
                'details': details,
                'issues': issues
            }
            
        except Exception as e:
            logger.error(f"Error analyzing frame: {str(e)}")
            return {
                'is_bad_posture': False,
                'message': f'Analysis error: {str(e)}',
                'confidence': 0.0,
                'details': {}
            }

# Initialize analyzer
analyzer = PostureAnalyzer()

@app.route('/', methods=['GET'])
def health_check():
    """Health check endpoint"""
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
    """Analyze posture from uploaded frame"""
    try:
        # Check if frame is in request
        if 'frame' not in request.files:
            return jsonify({'error': 'No frame provided'}), 400
        
        frame_file = request.files['frame']
        
        # Read and process image
        image_bytes = frame_file.read()
        image = Image.open(BytesIO(image_bytes))
        
        # Analyze the frame
        result = analyzer.analyze_frame(image)
        
        logger.info(f"Analysis result: {result}")
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error in analyze_posture: {str(e)}")
        return jsonify({
            'error': str(e),
            'is_bad_posture': False,
            'message': 'Analysis failed',
            'confidence': 0.0
        }), 500

@app.route('/test', methods=['GET'])
def test_endpoint():
    """Test endpoint for quick verification"""
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
    # Run the app
    app.run(debug=True, host='0.0.0.0', port=5000)