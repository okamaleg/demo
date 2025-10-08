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
import re
import requests

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

def generate_course(transcript, video_title, mode="full"):
    """Generate a course structure from the transcript using OpenAI with scenes and visual elements"""
    logger.info("Generating course from transcript with scenes and visual elements")
    
    try:
        # Use OpenAI to structure the transcript into a course with scenes
        # Tailor style guidelines based on mode
        if mode == "concise":
            style_instructions = (
                "Aim for brevity: fewer sections, 1-2 scenes per section, "
                "short bullet text, minimal visual elements per scene. Generate at most 1 quiz section with 3 questions."
            )
        else:
            style_instructions = (
                "Fully fledged: comprehensive sections, richer scenes with mixed visual elements, "
                "and quiz sections after every 2-3 content sections with 3-5 questions."
            )

        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": """
                You are a course creation expert and visual designer. Your task is to transform a video transcript into a well-structured course with engaging visual scenes and interactive quizzes.
                
                The course should include:
                1. A compelling title
                2. A concise description
                3. Multiple logical sections with appropriate titles
                4. Each section should contain multiple scenes with visual elements
                5. Quiz sections cadence and scene richness should follow this guidance: {STYLE_GUIDANCE}
                
                For each scene, determine the appropriate visual elements based on the content:
                - Avatar: When presenting information that would benefit from a human presenter
                - Images: When visual aids would enhance understanding
                - Text: Key points, definitions, or important concepts
                - Shapes: For diagrams, flowcharts, or highlighting relationships
                
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
                                    "narration": "Text to be narrated for this scene",
                                    "visual_elements": [
                                        {
                                            "type": "avatar",
                                            "position": "left|center|right",
                                            "emotion": "neutral|happy|serious|thoughtful",
                                            "style": "professional|casual|technical"
                                        },
                                        {
                                            "type": "image",
                                            "description": "Detailed description of the image needed",
                                            "position": "full|left|right|background",
                                            "style": "photo|illustration|diagram"
                                        },
                                        {
                                            "type": "text",
                                            "content": "Text content to display",
                                            "position": "top|middle|bottom",
                                            "style": "heading|bullet|quote|definition"
                                        },
                                        {
                                            "type": "shape",
                                            "shape_type": "arrow|rectangle|circle|line|star",
                                            "position": "coordinates or description",
                                            "purpose": "highlight|connect|separate"
                                        }
                                    ]
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
    """Process the uploaded video: extract transcript and generate course"""
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
        
        # Generate course
        mode = videos_db[video_id].get("mode", "full")
        course = generate_course(transcript, videos_db[video_id]["title"], mode)
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

def duckduckgo_search(query: str, max_results: int = 5):
    try:
        headers = {"User-Agent": "Mozilla/5.0"}
        resp = requests.get("https://duckduckgo.com/html/", params={"q": query}, headers=headers, timeout=10)
        resp.raise_for_status()
        html = resp.text
        # Very simple extraction of results
        links = re.findall(r'<a[^>]+class="result__a"[^>]+href="(.*?)"[^>]*>(.*?)</a>', html)
        results = []
        for href, title_html in links[:max_results]:
            # Clean title text
            title = re.sub('<[^<]+?>', '', title_html)
            results.append({"url": href, "title": title})
        return results
    except Exception as e:
        logger.warning(f"Search error: {e}")
        return []

@app.route('/augment', methods=['POST'])
def augment_content():
    """Augment content using internet sources + OpenAI to generate helpful blocks."""
    try:
        data = request.get_json(silent=True) or {}
        query = (data.get('query') or '').strip()
        context = (data.get('context') or '').strip()
        if not query:
            return jsonify({"error": "Missing query"}), 400

        sources = duckduckgo_search(query, max_results=5)
        sources_snippet = "\n".join([f"- {s.get('title')}: {s.get('url')}" for s in sources])

        prompt = f"""
You are an expert course copilot helping authors enrich sections with web-sourced explanations and references.
Task: Provide a concise, accurate augmentation that expands on the user's query, grounded in the following context (may be empty). Include explanations, key points, and actionable steps.

Context:\n{context[:4000]}

Query:\n{query}

Sources (web results):\n{sources_snippet}

Return a helpful markdown-style explanation (no code fences), followed by a short list of 2-4 bullet recommendations.
"""

        completion = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You produce concise, accurate learning augmentations."},
                {"role": "user", "content": prompt}
            ]
        )
        augmentation_text = completion.choices[0].message['content']

        return jsonify({
            "augmentation": augmentation_text,
            "sources": sources
        })
    except Exception as e:
        logger.error(f"Augment error: {e}")
        return jsonify({"error": "Augmentation failed"}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)