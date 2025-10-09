from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import uuid
import shutil
import logging
from dotenv import load_dotenv
import openai
import tempfile
import json
from werkzeug.utils import secure_filename
from moviepy.editor import VideoFileClip
import threading
import cv2
import numpy as np
from PIL import Image
import io
import base64

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize OpenAI client
openai_api_key = os.getenv("OPENAI_API_KEY")
if not openai_api_key:
    logger.warning("OPENAI_API_KEY not found in environment variables")
    openai_api_key = "dummy_key"  # For development without actual API calls

# Set the API key directly in the module
openai.api_key = openai_api_key

# Create Flask app
app = Flask(__name__, static_folder="static")
CORS(app)  # Enable CORS for all routes

# Create necessary directories
os.makedirs("uploads", exist_ok=True)
os.makedirs("static", exist_ok=True)
os.makedirs("static/js", exist_ok=True)

# In-memory storage for demo purposes
# In production, use a proper database
videos_db = {}
courses_db = {}

def extract_transcript(video_path):
    """Extract transcript from video using OpenAI Whisper API"""
    logger.info(f"Extracting transcript from {video_path}")
    
    try:
        # Extract audio from video
        with tempfile.NamedTemporaryFile(suffix='.mp3', delete=False) as temp_audio:
            temp_audio_path = temp_audio.name
        
        video_clip = VideoFileClip(video_path)
        video_clip.audio.write_audiofile(temp_audio_path, logger=None)
        video_clip.close()
        
        # Use OpenAI Whisper API to transcribe the audio
        with open(temp_audio_path, "rb") as audio_file:
            response = openai.Audio.transcribe(
                "whisper-1",
                audio_file
            )
        
        # Clean up temporary file
        os.unlink(temp_audio_path)
        
        return response.text
    
    except Exception as e:
        logger.error(f"Transcript extraction error: {str(e)}")
        raise Exception(f"Transcript extraction failed: {str(e)}")

def extract_video_snapshots(video_path, num_snapshots=10):
    """Extract smart snapshots from video at key moments"""
    logger.info(f"Extracting snapshots from {video_path}")
    
    try:
        # Open video with OpenCV
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise Exception("Could not open video file")
        
        # Get video properties
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        duration = total_frames / fps if fps > 0 else 0
        
        logger.info(f"Video: {total_frames} frames, {fps} fps, {duration:.2f}s duration")
        
        snapshots = []
        
        # Extract snapshots at strategic intervals
        if duration > 0:
            # Calculate snapshot times (avoid first and last 10% of video)
            start_time = duration * 0.1
            end_time = duration * 0.9
            time_interval = (end_time - start_time) / (num_snapshots - 1)
            
            for i in range(num_snapshots):
                target_time = start_time + (i * time_interval)
                frame_number = int(target_time * fps)
                
                # Seek to the frame
                cap.set(cv2.CAP_PROP_POS_FRAMES, frame_number)
                ret, frame = cap.read()
                
                if ret:
                    # Convert BGR to RGB
                    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    
                    # Convert to PIL Image
                    pil_image = Image.fromarray(frame_rgb)
                    
                    # Resize to standard size (800x600)
                    pil_image = pil_image.resize((800, 600), Image.Resampling.LANCZOS)
                    
                    # Convert to base64
                    buffer = io.BytesIO()
                    pil_image.save(buffer, format='JPEG', quality=85)
                    img_str = base64.b64encode(buffer.getvalue()).decode()
                    
                    snapshots.append({
                        'timestamp': target_time,
                        'frame_number': frame_number,
                        'image_data': f"data:image/jpeg;base64,{img_str}",
                        'description': f"Frame at {target_time:.1f}s"
                    })
        
        cap.release()
        logger.info(f"Extracted {len(snapshots)} snapshots")
        return snapshots
        
    except Exception as e:
        logger.error(f"Error extracting snapshots: {str(e)}")
        return []

def get_smart_snapshot_for_scene(snapshots, scene_index, total_scenes, scene_narration=""):
    """Select the most appropriate snapshot for a scene based on timing and content with randomization"""
    import random
    
    if not snapshots:
        return None
    
    # Calculate target time based on scene position
    if total_scenes > 1:
        # Distribute snapshots across scenes with some randomization
        base_ratio = scene_index / (total_scenes - 1)
        # Add random variation of ±10% to make snapshots more varied
        random_variation = random.uniform(-0.1, 0.1)
        target_ratio = max(0, min(1, base_ratio + random_variation))
    else:
        target_ratio = 0.5
    
    # Find the closest snapshot by time ratio
    target_time = snapshots[0]['timestamp'] + (target_ratio * (snapshots[-1]['timestamp'] - snapshots[0]['timestamp']))
    
    # Get the closest snapshot, but with some randomization
    closest_snapshot = min(snapshots, key=lambda x: abs(x['timestamp'] - target_time))
    
    # 20% chance to pick a nearby snapshot instead of the closest one
    if random.random() < 0.2 and len(snapshots) > 1:
        # Find snapshots within 30 seconds of the target time
        nearby_snapshots = [s for s in snapshots if abs(s['timestamp'] - target_time) <= 30]
        if nearby_snapshots:
            closest_snapshot = random.choice(nearby_snapshots)
    
    return closest_snapshot

def add_snapshots_to_course(course, snapshots):
    """Add video snapshots to course scenes as background images"""
    if not snapshots:
        return course
    
    # Count total scenes
    total_scenes = 0
    for section in course.get('sections', []):
        total_scenes += len(section.get('scenes', []))
    
    if total_scenes == 0:
        return course
    
    # Add snapshots to each scene
    scene_index = 0
    for section in course.get('sections', []):
        for scene in section.get('scenes', []):
            # Get appropriate snapshot for this scene
            snapshot = get_smart_snapshot_for_scene(
                snapshots, 
                scene_index, 
                total_scenes, 
                scene.get('narration', '')
            )
            
            if snapshot:
                # Add snapshot as the main visual element (large, centered)
                if 'visual_elements' not in scene:
                    scene['visual_elements'] = []
                
                # Add video snapshot as the main visual element (takes up most of the screen)
                video_snapshot = {
                    'type': 'image',
                    'x': 400,  # Center of 800px canvas
                    'y': 225,  # Center of 450px canvas
                    'width': 600,  # Large but not full screen
                    'height': 400,  # Large but not full screen
                    'image_data': snapshot['image_data'],
                    'is_video_snapshot': True,  # Changed from is_background
                    'description': f"Video frame at {snapshot['timestamp']:.1f}s",
                    'priority': 'main'  # Mark as main visual element
                }
                
                # Add as the first visual element
                scene['visual_elements'].insert(0, video_snapshot)
                
                # Add smart complementary elements around the video snapshot
                smart_elements = generate_smart_elements_for_scene(scene, snapshot)
                scene['visual_elements'].extend(smart_elements)
                
                # Add snapshot metadata to scene
                scene['video_snapshot'] = {
                    'timestamp': snapshot['timestamp'],
                    'frame_number': snapshot['frame_number'],
                    'description': snapshot['description']
                }
            
            scene_index += 1
    
    return course

def generate_smart_elements_for_scene(scene, snapshot):
    """Generate smart complementary visual elements around the video snapshot with randomization"""
    import random
    elements = []
    narration = scene.get('narration', '').lower()
    
    # Analyze narration content to determine what elements to add
    has_question = '?' in scene.get('narration', '')
    has_exclamation = '!' in scene.get('narration', '')
    has_numbers = any(char.isdigit() for char in scene.get('narration', ''))
    is_explanatory = any(word in narration for word in ['explain', 'show', 'demonstrate', 'illustrate'])
    is_question = any(word in narration for word in ['what', 'how', 'why', 'when', 'where'])
    has_important = any(word in narration for word in ['important', 'key', 'main', 'primary', 'essential'])
    has_comparison = any(word in narration for word in ['compare', 'versus', 'vs', 'different', 'similar'])
    has_process = any(word in narration for word in ['step', 'process', 'method', 'way', 'approach'])
    
    # Avatar configurations with randomization
    avatar_configs = {
        'questioning': {
            'emotions': ['thoughtful', 'serious'],
            'hair_colors': ['#654321', '#2F4F4F', '#8B4513', '#000000'],
            'shirt_colors': ['#2E8B57', '#4A90E2', '#8B0000', '#9370DB'],
            'positions': [(650, 100), (700, 80), (600, 120)]
        },
        'explaining': {
            'emotions': ['happy', 'serious'],
            'hair_colors': ['#8B4513', '#DAA520', '#654321', '#2F4F4F'],
            'shirt_colors': ['#4A90E2', '#2E8B57', '#FF6347', '#32CD32'],
            'positions': [(150, 100), (100, 80), (200, 120)]
        },
        'neutral': {
            'emotions': ['serious', 'thoughtful'],
            'hair_colors': ['#2F4F4F', '#8B4513', '#654321', '#000000'],
            'shirt_colors': ['#8B0000', '#4A90E2', '#2E8B57', '#9370DB'],
            'positions': [(400, 350), (350, 320), (450, 380)]
        }
    }
    
    # Add avatar based on content type with randomization
    if is_question or has_question:
        config = avatar_configs['questioning']
        avatar = {
            'type': 'avatar',
            'x': random.choice(config['positions'])[0],
            'y': random.choice(config['positions'])[1],
            'emotion': random.choice(config['emotions']),
            'hairColor': random.choice(config['hair_colors']),
            'shirtColor': random.choice(config['shirt_colors']),
            'description': 'Questioning avatar'
        }
        elements.append(avatar)
    elif is_explanatory or has_exclamation:
        config = avatar_configs['explaining']
        avatar = {
            'type': 'avatar',
            'x': random.choice(config['positions'])[0],
            'y': random.choice(config['positions'])[1],
            'emotion': random.choice(config['emotions']),
            'hairColor': random.choice(config['hair_colors']),
            'shirtColor': random.choice(config['shirt_colors']),
            'description': 'Explaining avatar'
        }
        elements.append(avatar)
    else:
        config = avatar_configs['neutral']
        avatar = {
            'type': 'avatar',
            'x': random.choice(config['positions'])[0],
            'y': random.choice(config['positions'])[1],
            'emotion': random.choice(config['emotions']),
            'hairColor': random.choice(config['hair_colors']),
            'shirtColor': random.choice(config['shirt_colors']),
            'description': 'Neutral avatar'
        }
        elements.append(avatar)
    
    # Random chance to add additional elements (30% chance for each)
    if random.random() < 0.3:
        # Add text elements for key points
        if has_numbers:
            highlight_colors = ['#fbbf24', '#f59e0b', '#d97706', '#92400e']
            highlight_positions = [(100, 380), (80, 360), (120, 400)]
            x, y = random.choice(highlight_positions)
            highlight = {
                'type': 'shape',
                'x': x,
                'y': y,
                'shape_type': 'rectangle',
                'width': random.randint(100, 140),
                'height': random.randint(35, 45),
                'color': random.choice(highlight_colors),
                'description': 'Number highlight'
            }
            elements.append(highlight)
    
    if random.random() < 0.3:
        # Add callout shapes for important concepts
        if is_explanatory or has_important:
            arrow_colors = ['#3b82f6', '#1d4ed8', '#1e40af', '#1e3a8a']
            arrow_positions = [(200, 225), (180, 200), (220, 250)]
            x, y = random.choice(arrow_positions)
            arrow = {
                'type': 'shape',
                'x': x,
                'y': y,
                'shape_type': 'arrow',
                'width': random.randint(50, 70),
                'height': random.randint(25, 35),
                'color': random.choice(arrow_colors),
                'description': 'Attention arrow'
            }
            elements.append(arrow)
    
    if random.random() < 0.3:
        # Add text overlay for key terms
        if len(narration.split()) > 10:  # Longer narration
            text_positions = [(650, 300), (680, 280), (620, 320)]
            x, y = random.choice(text_positions)
            text_contents = ['Key Points', 'Important', 'Note', 'Remember', 'Focus']
            text_box = {
                'type': 'text',
                'x': x,
                'y': y,
                'content': random.choice(text_contents),
                'font_size': random.randint(14, 18),
                'color': '#1f2937',
                'background_color': '#f3f4f6',
                'description': 'Key points text'
            }
            elements.append(text_box)
    
    # Add process-related elements with randomization
    if random.random() < 0.4 and has_process:
        step_colors = ['#10b981', '#059669', '#047857', '#065f46']
        step_positions = [(50, 200), (30, 180), (70, 220)]
        x, y = random.choice(step_positions)
        step_indicator = {
            'type': 'shape',
            'x': x,
            'y': y,
            'shape_type': 'circle',
            'width': random.randint(30, 40),
            'height': random.randint(30, 40),
            'color': random.choice(step_colors),
            'description': 'Process step'
        }
        elements.append(step_indicator)
    
    # Add comparison elements with randomization
    if random.random() < 0.3 and has_comparison:
        comparison_colors = ['#f59e0b', '#d97706', '#92400e', '#78350f']
        comparison_positions = [(720, 200), (750, 180), (690, 220)]
        x, y = random.choice(comparison_positions)
        comparison_shape = {
            'type': 'shape',
            'x': x,
            'y': y,
            'shape_type': 'rectangle',
            'width': random.randint(60, 80),
            'height': random.randint(40, 50),
            'color': random.choice(comparison_colors),
            'description': 'Comparison indicator'
        }
        elements.append(comparison_shape)
    
    # Random chance to add a second avatar (10% chance)
    if random.random() < 0.1:
        second_avatar_positions = [(100, 300), (700, 300), (400, 50), (400, 400)]
        x, y = random.choice(second_avatar_positions)
        second_avatar = {
            'type': 'avatar',
            'x': x,
            'y': y,
            'emotion': random.choice(['happy', 'serious', 'thoughtful']),
            'hairColor': random.choice(['#8B4513', '#654321', '#2F4F4F', '#DAA520']),
            'shirtColor': random.choice(['#4A90E2', '#2E8B57', '#8B0000', '#9370DB']),
            'description': 'Secondary avatar'
        }
        elements.append(second_avatar)
    
    return elements

def generate_course(transcript, video_title, mode="full"):
    """Generate a course structure from the transcript using OpenAI with scenes and visual elements"""
    logger.info("Generating course from transcript with scenes and visual elements")
    
    try:
        # Use OpenAI to structure the transcript into a course with scenes
        # Tailor style guidelines based on mode
        if mode == "concise":
            style_instructions = (
                "Aim for brevity: 3-4 sections, 1-2 scenes per section, "
                "short bullet text, minimal visual elements per scene. Generate at most 1 quiz section with 3 questions."
            )
        else:
            style_instructions = (
                "Fully fledged comprehensive course: Create 6-8 detailed sections with 3-5 scenes each. "
                "Each scene should have rich, detailed narration (2-4 sentences). "
                "Include quiz sections after every 2-3 content sections with 4-5 questions each. "
                "Ensure the course covers the entire transcript content thoroughly with proper learning progression."
            )

        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": """
                You are a course creation expert and visual designer. Your task is to transform a video transcript into a well-structured, comprehensive course with engaging visual scenes and interactive quizzes.
                
                The course should include:
                1. A compelling, descriptive title
                2. A detailed description (2-3 sentences)
                3. Multiple logical sections with clear, descriptive titles
                4. Each section should contain multiple scenes with rich narration
                5. Quiz sections cadence and scene richness should follow this guidance: {STYLE_GUIDANCE}
                
                IMPORTANT: Ensure you use the ENTIRE transcript content. Break down the content into logical learning chunks. 
                Each scene should have substantial narration (2-4 sentences) that covers specific aspects of the content.
                Don't skip or summarize too much - create a comprehensive learning experience.
                
                For each scene, focus on creating engaging, detailed narration. Visual elements will be automatically generated from the video content.
                
                For quiz sections, create 3-5 relevant questions that test understanding of the preceding content sections. Each question should have:
                - Clear, specific question text
                - 4 multiple choice options (A, B, C, D)
                - One correct answer
                - Explanations for why the correct answer is right
                
                Format your response as valid JSON with the following structure. In addition to scenes, also include an optional block-based representation for each content section to support a different player mode:
                {
                    "title": "Course Title",
                    "description": "Course description",
                    "sections": [
                        {
                            "title": "Section Title",
                            "type": "content|quiz",
                            "duration": "Estimated duration",
                            "scenes": [
                                {
                                    "scene_type": "introduction|content|summary",
                                    "narration": "Text to be narrated for this scene"
                                }
                            ],
                            "blocks": [
                                { "type": "text", "content": "Short paragraph" },
                                { "type": "image", "url": "optional-or-description", "alt": "desc" },
                                { "type": "video", "source": "from uploaded video or url", "timestamp": 12 },
                                { "type": "doc", "url": "document url or summary", "title": "Doc title" },
                                { "type": "flipcard", "front": "term", "back": "definition" },
                                { "type": "checklist", "items": [ { "text": "Step 1" }, { "text": "Step 2" } ] }
                            ],
                            "questions": [
                                {
                                    "question": "Question text here",
                                    "options": {
                                        "A": "Option A text",
                                        "B": "Option B text", 
                                        "C": "Option C text",
                                        "D": "Option D text"
                                    },
                                    "correct_answer": "A|B|C|D",
                                    "explanation": "Explanation of why this answer is correct"
                                }
                            ]
                        }
                    ],
                    "metadata": {
                        "source": "video transcript",
                        "difficulty": "beginner|intermediate|advanced",
                        "target_audience": "description of intended audience",
                        "estimated_total_duration": "total duration"
                    }
                }
                
                Notes:
                - Include only the visual elements that make sense for each scene
                - Ensure the narration text flows naturally with the visual elements
                - Make sure each scene has a clear purpose and communicates effectively
                - Use a variety of visual elements to maintain engagement
                - Keep the scenes focused and not overcrowded with too many elements
                - When creating blocks, choose a mix of types (image, video, doc, flipcard, checklist) that best convey the section's key points. Keep blocks concise and self-contained.
                - For quiz sections: set "type": "quiz" and include relevant questions
                - For content sections: set "type": "content" and focus on scenes
                - Adjust the number and depth of sections/scenes based on the style guidance
                - Quiz questions should test understanding of the preceding content sections
                - Make quiz questions challenging but fair, testing key concepts
                """},
                {"role": "user", "content": f"Video Title: {video_title}\n\nTranscript: {transcript}\n\nSTYLE_GUIDANCE: {style_instructions}"}
            ]
        )
        
        course_data = response.choices[0].message['content']
        
        # Parse the JSON response
        try:
            course = json.loads(course_data)
        except json.JSONDecodeError as e:
            logger.error(f"JSON parsing error: {str(e)}")
            logger.error(f"Received data: {course_data}")
            # Try to clean the response and parse again
            cleaned_data = course_data.strip()
            if cleaned_data.startswith('```json'):
                cleaned_data = cleaned_data[7:]
            if cleaned_data.endswith('```'):
                cleaned_data = cleaned_data[:-3]
            cleaned_data = cleaned_data.strip()
            course = json.loads(cleaned_data)
        
        return course
    
    except Exception as e:
        logger.error(f"Course generation error: {str(e)}")
        raise Exception(f"Course generation failed: {str(e)}")

def process_video(video_id):
    """Process the uploaded video: extract transcript, snapshots, and generate course"""
    if video_id not in videos_db:
        logger.error(f"Video ID {video_id} not found")
        return
    
    try:
        # Update status
        videos_db[video_id]["status"] = "processing"
        
        # Extract transcript
        transcript = extract_transcript(videos_db[video_id]["path"])
        logger.info(f"Transcript: {transcript}")
        videos_db[video_id]["transcript"] = transcript
        videos_db[video_id]["status"] = "transcript_extracted"
        
        # Extract video snapshots
        logger.info("Extracting video snapshots...")
        snapshots = extract_video_snapshots(videos_db[video_id]["path"], num_snapshots=15)
        videos_db[video_id]["snapshots"] = snapshots
        videos_db[video_id]["status"] = "snapshots_extracted"
        logger.info(f"Extracted {len(snapshots)} snapshots")
        
        # Generate course
        mode = videos_db[video_id].get("mode", "full")
        course = generate_course(transcript, videos_db[video_id]["title"], mode)
        
        # Add video snapshots to scenes
        course = add_snapshots_to_course(course, snapshots)
        
        course_id = str(uuid.uuid4())
        courses_db[course_id] = course
        
        # Update video record with course ID
        videos_db[video_id]["course_id"] = course_id
        videos_db[video_id]["status"] = "completed"
        
    except Exception as e:
        logger.error(f"Error processing video {video_id}: {str(e)}")
        videos_db[video_id]["status"] = "error"
        videos_db[video_id]["error"] = str(e)

@app.route('/upload-video/', methods=['POST'])
def upload_video():
    """Upload a video file and start processing it"""
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    if not file.filename:
        return jsonify({"error": "No selected file"}), 400
    
    if not file.filename.lower().endswith(('.mp4', '.mov', '.avi', '.wmv')):
        return jsonify({"error": "Invalid video file format"}), 400
    
    # Generate unique ID for the video
    video_id = str(uuid.uuid4())
    
    # Save the uploaded file
    filename = secure_filename(file.filename)
    file_path = f"uploads/{video_id}_{filename}"
    file.save(file_path)
    
    # Store video metadata
    video_title = request.form.get('title', filename)
    generation_mode = request.form.get('mode', 'full')
    videos_db[video_id] = {
        "id": video_id,
        "title": video_title,
        "filename": filename,
        "path": file_path,
        "status": "uploaded",
        "transcript": None,
        "course_id": None,
        "mode": generation_mode
    }
    
    # Process the video in a background thread
    threading.Thread(target=process_video, args=(video_id,)).start()
    
    return jsonify({"video_id": video_id, "title": video_title, "status": "processing"})

@app.route('/video/<video_id>', methods=['GET'])
def get_video_status(video_id):
    """Get the status of a video processing job"""
    if video_id not in videos_db:
        return jsonify({"error": "Video not found"}), 404
    
    return jsonify(videos_db[video_id])

@app.route('/course/<course_id>', methods=['GET', 'PUT'])
def course_operations(course_id):
    """Get or update a generated course by ID"""
    if request.method == 'GET':
        if course_id not in courses_db:
            return jsonify({"error": "Course not found"}), 404
        
        return jsonify(courses_db[course_id])
    
    elif request.method == 'PUT':
        if course_id not in courses_db:
            return jsonify({"error": "Course not found"}), 404
        
        # Update course with new data
        updated_course = request.json
        courses_db[course_id] = updated_course
        
        return jsonify({"message": "Course updated successfully"})

@app.route('/', methods=['GET'])
def index():
    """Serve the index.html file"""
    return send_from_directory('static', 'index.html')

@app.route('/<path:path>', methods=['GET'])
def serve_static(path):
    """Serve static files"""
    return send_from_directory('static', path)

@app.route('/api', methods=['GET'])
def api_root():
    """API root endpoint"""
    return jsonify({"message": "Video to Course Generator API"})

@app.route('/images', methods=['GET'])
def list_images():
    """List available static images to be used as scene backgrounds"""
    images_dir = os.path.join(app.static_folder, 'images')
    try:
        files = []
        if os.path.isdir(images_dir):
            for name in sorted(os.listdir(images_dir)):
                if name.lower().endswith(('.png', '.jpg', '.jpeg', '.webp', '.gif')):
                    files.append(f"/images/{name}")
        return jsonify({"images": files})
    except Exception as e:
        logger.error(f"Error listing images: {e}")
        return jsonify({"error": "Failed to list images"}), 500

def analyze_content_quality(text, content_type="narration"):
    """Analyze content quality and provide enhancement suggestions"""
    try:
        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": f"""
                You are an expert educational content analyst. Analyze the following {content_type} text and provide specific, actionable suggestions for improvement.
                
                Return a JSON response with:
                {{
                    "overall_score": 0-100,
                    "clarity_score": 0-100,
                    "engagement_score": 0-100,
                    "accessibility_score": 0-100,
                    "suggestions": [
                        {{
                            "type": "clarity|engagement|accessibility|structure",
                            "priority": "high|medium|low",
                            "suggestion": "Specific improvement suggestion",
                            "reason": "Why this improvement helps"
                        }}
                    ],
                    "improved_text": "Enhanced version of the text",
                    "key_insights": [
                        "Key insights about the content"
                    ]
                }}
                """},
                {"role": "user", "content": text}
            ]
        )
        
        analysis = json.loads(response.choices[0].message['content'])
        return analysis
    
    except Exception as e:
        logger.error(f"Content analysis error: {str(e)}")
        return {
            "overall_score": 75,
            "clarity_score": 75,
            "engagement_score": 75,
            "accessibility_score": 75,
            "suggestions": [],
            "improved_text": text,
            "key_insights": ["Analysis temporarily unavailable"]
        }

def generate_content_suggestions(course_data, section_index=None, scene_index=None):
    """Generate AI-powered content suggestions for course improvement"""
    try:
        # Get the specific content to analyze
        if section_index is not None and scene_index is not None:
            section = course_data['sections'][section_index]
            scene = section['scenes'][scene_index]
            content = scene.get('narration', '')
            context = f"Scene: {scene.get('scene_type', 'content')} in section: {section.get('title', 'Untitled')}"
        else:
            # Analyze entire course
            content = course_data.get('description', '') + " " + " ".join([
                scene.get('narration', '') for section in course_data.get('sections', [])
                for scene in section.get('scenes', [])
            ])
            context = "Entire course content"
        
        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": """
                You are an expert educational content strategist. Analyze the course content and provide strategic suggestions for improvement.
                
                Return a JSON response with:
                {
                    "content_gaps": [
                        {
                            "gap": "Missing concept or explanation",
                            "importance": "high|medium|low",
                            "suggestion": "How to address this gap"
                        }
                    ],
                    "engagement_opportunities": [
                        {
                            "opportunity": "Specific engagement opportunity",
                            "type": "interactive|visual|quiz|discussion",
                            "implementation": "How to implement this"
                        }
                    ],
                    "learning_flow_improvements": [
                        {
                            "issue": "Flow or structure issue",
                            "suggestion": "How to improve the flow"
                        }
                    ],
                    "accessibility_improvements": [
                        {
                            "issue": "Accessibility concern",
                            "suggestion": "How to make content more accessible"
                        }
                    ],
                    "difficulty_assessment": {
                        "current_level": "beginner|intermediate|advanced",
                        "target_audience": "Who this content is best suited for",
                        "complexity_notes": "Notes about content complexity"
                    }
                }
                """},
                {"role": "user", "content": f"Context: {context}\n\nContent: {content}"}
            ]
        )
        
        suggestions = json.loads(response.choices[0].message['content'])
        return suggestions
    
    except Exception as e:
        logger.error(f"Content suggestions error: {str(e)}")
        return {
            "content_gaps": [],
            "engagement_opportunities": [],
            "learning_flow_improvements": [],
            "accessibility_improvements": [],
            "difficulty_assessment": {
                "current_level": "intermediate",
                "target_audience": "General audience",
                "complexity_notes": "Analysis temporarily unavailable"
            }
        }

@app.route('/api/analyze-content', methods=['POST'])
def analyze_content():
    """Analyze content quality and provide suggestions"""
    try:
        data = request.json
        text = data.get('text', '')
        content_type = data.get('type', 'narration')
        
        if not text:
            return jsonify({"error": "No text provided"}), 400
        
        analysis = analyze_content_quality(text, content_type)
        return jsonify(analysis)
    
    except Exception as e:
        logger.error(f"Content analysis endpoint error: {str(e)}")
        return jsonify({"error": "Analysis failed"}), 500

@app.route('/api/content-suggestions/<course_id>', methods=['GET', 'POST'])
def content_suggestions(course_id):
    """Get AI-powered content suggestions for a course"""
    try:
        if course_id not in courses_db:
            return jsonify({"error": "Course not found"}), 404
        
        course_data = courses_db[course_id]
        
        # Get specific section/scene if provided
        section_index = request.args.get('section_index', type=int)
        scene_index = request.args.get('scene_index', type=int)
        
        suggestions = generate_content_suggestions(course_data, section_index, scene_index)
        return jsonify(suggestions)
    
    except Exception as e:
        logger.error(f"Content suggestions endpoint error: {str(e)}")
        return jsonify({"error": "Suggestions generation failed"}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)