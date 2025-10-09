// React Course Player Component
class CoursePlayer extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      course: props.course,
      currentSection: 0,
      currentScene: 0,
      isPlaying: false,
      progress: 0,
      mode: 'view', // 'view' or 'edit' or 'video'
      role: props.role || 'learner', // 'author' | 'learner'
      selectedScene: null,
      isEditorOpen: false,
      sceneToEdit: null,
      totalScenes: 0,
      sceneDurations: [],
      isQuizOpen: false,
      currentQuiz: null,
      quizResults: {},
      voiceOverEnabled: true,
      isCanvasHovered: false
    };
    this.canvasRef = React.createRef();
    this.animationRef = null;
    this.videoAnimationRef = null;
    // Preload placeholder image for scene images
    this.scenePlaceholderImage = new Image();
    this.scenePlaceholderLoaded = false;
    this.scenePlaceholderImage.onload = () => { this.scenePlaceholderLoaded = true; };
    this.scenePlaceholderImage.src = '/images/image.png';
    // Speech synthesis placeholders
    this.voices = [];
    this.selectedVoice = null;
    this.currentUtterance = null;
    // Image mapping
    this.sceneImageMap = []; // array of Image objects aligned to flattened scenes
    this.sceneImageUrls = [];
  }

  componentDidMount() {
    this.drawCurrentScene();
    this.calculateTotalScenes();
    // Initialize TTS voices
    if ('speechSynthesis' in window) {
      const loadVoices = () => {
        this.voices = window.speechSynthesis.getVoices();
        // Prefer more natural voices
        this.selectedVoice = this.voices.find(v => 
          (v.name || '').toLowerCase().includes('google') || 
          (v.name || '').toLowerCase().includes('samantha') ||
          (v.name || '').toLowerCase().includes('alex') ||
          (v.name || '').toLowerCase().includes('daniel')
        ) || this.voices.find(v => (v.lang || '').toLowerCase().startsWith('en')) || this.voices[0] || null;
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    // Fetch available images and preload
    this.fetchAndMapImages();
    
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevState.currentScene !== this.state.currentScene || 
        prevState.currentSection !== this.state.currentSection ||
        prevState.isPlaying !== this.state.isPlaying) {
      this.drawCurrentScene();
    }
    
    if (prevProps.course !== this.props.course) {
      this.setState({ course: this.props.course }, () => {
        this.calculateTotalScenes();
        this.drawCurrentScene();
      });
    }
    
    if (prevState.videoMode !== this.state.videoMode && this.state.videoMode) {
      this.startVideoPlayback();
    }
    // Re-map images if course changes
    if (prevProps.course !== this.props.course) {
      this.fetchAndMapImages();
    }
  }

  async fetchAndMapImages() {
    try {
      const resp = await fetch('/images');
      if (!resp.ok) return;
      const data = await resp.json();
      const urls = Array.isArray(data.images) ? data.images : [];
      this.sceneImageUrls = urls;
      // Preload images
      const loaded = await Promise.all(urls.map(u => new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = u;
      })));
      // Map sequentially across content scenes (ignore quiz sections)
      const map = [];
      let idx = 0;
      const course = this.props.course;
      if (course && Array.isArray(course.sections)) {
        course.sections.forEach(section => {
          if (Array.isArray(section.scenes)) {
            section.scenes.forEach(() => {
              map.push(loaded[idx] || null);
              if (idx < loaded.length - 1) idx++;
            });
          }
        });
      }
      this.sceneImageMap = map;
    } catch (_) {}
  }

  componentWillUnmount() {
    if (this.animationRef) {
      cancelAnimationFrame(this.animationRef);
    }
    if (this.videoAnimationRef) {
      cancelAnimationFrame(this.videoAnimationRef);
    }
    this.stopVoiceOver();
  }
  
  calculateTotalScenes() {
    const course = this.state.course;
    if (!course || !course.sections) return;
    
    let totalScenes = 0;
    const sceneDurations = [];
    
    course.sections.forEach(section => {
      if (section.scenes) {
        section.scenes.forEach(scene => {
          totalScenes++;
          // Use provided duration or estimate from content
          sceneDurations.push(this.estimateSceneDuration(scene));
        });
      }
    });
    
    this.setState({ totalScenes, sceneDurations });
  }

  estimateSceneDuration(scene) {
    if (!scene) return 5;
    if (typeof scene.duration === 'number' && isFinite(scene.duration) && scene.duration > 0) {
      return scene.duration; // seconds
    }
    
    // Smart duration calculation (same as scene editor)
    const narration = (scene.narration || '').trim();
    if (!narration) return 3; // Default 3 seconds for empty content
    
    // Calculate based on word count and reading speed
    const words = narration.trim().split(/\s+/).length;
    
    // Base calculation: ~140 words per minute = ~0.43 seconds per word
    let baseDuration = Math.max(3, Math.round(words * 0.43));
    
    // Adjust for content complexity
    const visualElements = Array.isArray(scene.visual_elements) ? scene.visual_elements.length : 0;
    const hasComplexWords = /[A-Z]{3,}|[0-9]+|\.{2,}|!{2,}|\?{2,}/.test(narration);
    
    // Add time for visual elements (up to 4 seconds)
    baseDuration += Math.min(4, Math.floor(visualElements / 2));
    
    // Add time for complex content (up to 3 seconds)
    if (hasComplexWords) {
      baseDuration += Math.min(3, Math.floor(words / 20));
    }
    
    // Add time for punctuation pauses
    const punctuationCount = (narration.match(/[.!?]/g) || []).length;
    baseDuration += Math.min(2, punctuationCount * 0.3);
    
    // Clamp to reasonable bounds
    return Math.max(3, Math.min(30, baseDuration));
  }

  drawCurrentScene() {
    // Don't draw if we're in video mode
    if (this.state.videoMode) {
      return;
    }

    const canvas = this.canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    canvas.width = 800;
    canvas.height = 450;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const scene = this.getCurrentScene();
    if (!scene) {
      this.drawEmptyScene(ctx, canvas.width, canvas.height);
      return;
    }
    
    // Draw the scene using unified renderer
    this.drawScene(ctx, canvas.width, canvas.height, scene);
    
    // Continue animation for lip syncing
    if (this.state.voiceOverEnabled && this.state.isPlaying) {
      requestAnimationFrame(() => this.drawCurrentScene());
    }
  }

  drawEmptyScene = (ctx, width, height) => {
    // Draw gradient background
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#3b82f6');
    gradient.addColorStop(1, '#2563eb');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // Draw "No scene" message
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No scene available', width / 2, height / 2);
  }

  drawScene = (ctx, width, height, scene) => {
    // Draw gradient background
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#3b82f6');
    gradient.addColorStop(1, '#2563eb');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // Draw visual elements
    if (scene.visual_elements && scene.visual_elements.length > 0) {
      scene.visual_elements.forEach(element => {
        this.drawElement(ctx, width, height, element);
      });
    }
    
    // Draw scene info overlay
    this.drawSceneOverlay(ctx, width, height, scene);
  }

  drawSceneOverlay = (ctx, width, height, scene) => {
    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, height - 100, width, 100);
    
    // Scene title
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Scene ${this.state.currentScene + 1} - ${scene.scene_type || 'Content'}`, 20, height - 75);
    
    // Narration text (truncated)
    ctx.font = '14px Arial';
    const narration = scene.narration || '';
    const words = narration.split(' ');
    let line = '';
    const lines = [];
    const maxWidth = width - 40;
    
    words.forEach(word => {
      const testLine = line + word + ' ';
      if (ctx.measureText(testLine).width > maxWidth) {
        lines.push(line);
        line = word + ' ';
      } else {
        line = testLine;
      }
    });
    lines.push(line);
    
    lines.slice(0, 2).forEach((line, idx) => {
      ctx.fillText(line, 20, height - 50 + idx * 20);
    });
    
    if (lines.length > 2) {
      ctx.fillText('...', 20, height - 10);
    }
  }

  drawElement = (ctx, width, height, element) => {
    // Get element position - use explicit coordinates if available, otherwise use position
    const x = element.x !== undefined ? element.x : (element.position === 'left' ? 150 : element.position === 'right' ? 650 : 400);
    const y = element.y !== undefined ? element.y : (element.position === 'top' ? 100 : element.position === 'bottom' ? 350 : 225);
    
    switch (element.type) {
      case 'avatar':
        this.drawAvatarElement(ctx, x, y, element);
        break;
      case 'image':
        this.drawImageElement(ctx, x, y, element);
        break;
      case 'text':
        this.drawTextElement(ctx, x, y, element);
        break;
      case 'shape':
        this.drawShapeElement(ctx, x, y, element);
        break;
    }
  }

  drawAvatarElement = (ctx, x, y, element) => {
    const avatarSize = 120;
    const isSpeaking = this.state.voiceOverEnabled && this.state.isPlaying;
    
    // Draw avatar background circle
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.arc(x, y, avatarSize / 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw human avatar
    this.drawHumanAvatar(ctx, x, y, avatarSize, element, isSpeaking);
  }

  drawHumanAvatar = (ctx, x, y, size, element, isSpeaking) => {
    const scale = size / 100;
    
    // Face
    ctx.fillStyle = '#FDBCB4'; // Skin tone
    ctx.beginPath();
    ctx.arc(x, y - 5, 35 * scale, 0, Math.PI * 2);
    ctx.fill();
    
    // Hair
    ctx.fillStyle = element.hairColor || '#8B4513';
    ctx.beginPath();
    ctx.arc(x, y - 15, 40 * scale, Math.PI, 0);
    ctx.fill();
    
    // Eyes
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(x - 12 * scale, y - 10, 3 * scale, 0, Math.PI * 2);
    ctx.arc(x + 12 * scale, y - 10, 3 * scale, 0, Math.PI * 2);
    ctx.fill();
    
    // Eye highlights
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(x - 11 * scale, y - 11, 1 * scale, 0, Math.PI * 2);
    ctx.arc(x + 13 * scale, y - 11, 1 * scale, 0, Math.PI * 2);
    ctx.fill();
    
    // Eyebrows
    ctx.strokeStyle = element.hairColor || '#8B4513';
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.moveTo(x - 18 * scale, y - 18);
    ctx.lineTo(x - 6 * scale, y - 16);
    ctx.moveTo(x + 6 * scale, y - 16);
    ctx.lineTo(x + 18 * scale, y - 18);
    ctx.stroke();
    
    // Nose
    ctx.fillStyle = '#E8A87C';
    ctx.beginPath();
    ctx.arc(x, y - 2, 2 * scale, 0, Math.PI * 2);
    ctx.fill();
    
    // Mouth with lip sync
    this.drawMouth(ctx, x, y + 8, scale, isSpeaking, element.emotion);
    
    // Body/shirt
    ctx.fillStyle = element.shirtColor || '#4A90E2';
    ctx.fillRect(x - 25 * scale, y + 25, 50 * scale, 40 * scale);
    
    // Arms
    ctx.fillStyle = '#FDBCB4';
    ctx.fillRect(x - 35 * scale, y + 30, 15 * scale, 25 * scale);
    ctx.fillRect(x + 20 * scale, y + 30, 15 * scale, 25 * scale);
  }

  drawMouth = (ctx, x, y, scale, isSpeaking, emotion) => {
    ctx.fillStyle = '#8B0000'; // Lip color
    
    if (isSpeaking) {
      // Animated speaking mouth
      const time = Date.now() * 0.01;
      const mouthOpenness = Math.sin(time) * 0.5 + 0.5;
      
      // Open mouth for speaking
      ctx.beginPath();
      ctx.ellipse(x, y, 8 * scale, 4 * scale * mouthOpenness, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Teeth
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.ellipse(x, y, 6 * scale, 2 * scale * mouthOpenness, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Closed mouth with emotion
      switch (emotion) {
        case 'happy':
          // Smile
          ctx.beginPath();
          ctx.arc(x, y - 2, 8 * scale, 0, Math.PI);
          ctx.stroke();
          break;
        case 'serious':
          // Straight line
          ctx.beginPath();
          ctx.moveTo(x - 6 * scale, y);
          ctx.lineTo(x + 6 * scale, y);
          ctx.stroke();
          break;
        case 'thoughtful':
          // Slight frown
          ctx.beginPath();
          ctx.arc(x, y + 2, 8 * scale, Math.PI, 0);
          ctx.stroke();
          break;
        default:
          // Neutral mouth
          ctx.beginPath();
          ctx.moveTo(x - 4 * scale, y);
          ctx.lineTo(x + 4 * scale, y);
          ctx.stroke();
      }
    }
  }

  drawImageElement = (ctx, x, y, element) => {
    const imgWidth = element.width || 200;
    const imgHeight = element.height || 150;
    
    // Check if this is a video snapshot
    if (element.is_video_snapshot && element.image_data) {
      // Draw the actual video snapshot
      const img = new Image();
      img.onload = () => {
        // Redraw the canvas when image loads
        this.drawCurrentScene();
      };
      img.src = element.image_data;
      
      // Draw the image at its specified size
      ctx.drawImage(img, x - imgWidth/2, y - imgHeight/2, imgWidth, imgHeight);
      
      // Add a subtle border to indicate it's a video snapshot
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - imgWidth/2, y - imgHeight/2, imgWidth, imgHeight);
    } else {
      // Regular image placeholder
      ctx.fillStyle = '#e5e7eb';
      ctx.fillRect(x - imgWidth/2, y - imgHeight/2, imgWidth, imgHeight);
      
      // Draw image icon
      ctx.font = '24px Arial';
      ctx.fillStyle = '#6b7280';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🖼️', x, y);
    }
  }

  drawTextElement = (ctx, x, y, element) => {
    const content = element.content || '';
    const maxWidth = 300;
    
    // Draw text background
    ctx.fillStyle = 'rgba(255, 243, 205, 0.8)';
    ctx.fillRect(x - maxWidth/2, y - 20, maxWidth, 40);
    
    // Draw text
    ctx.font = this.getTextFontByStyle(element.style);
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(content, x, y);
  }

  drawShapeElement = (ctx, x, y, element) => {
    const width = element.width || 100;
    const height = element.height || 100;
    
    ctx.fillStyle = element.color || 'rgba(220, 53, 69, 0.3)';
    ctx.strokeStyle = element.color || 'rgba(220, 53, 69, 0.7)';
    ctx.lineWidth = 2;
    
    switch (element.shape_type) {
      case 'rectangle':
        ctx.fillRect(x - width/2, y - height/2, width, height);
        ctx.strokeRect(x - width/2, y - height/2, width, height);
        break;
      case 'circle':
        ctx.beginPath();
        ctx.arc(x, y, width/2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      case 'arrow':
        ctx.beginPath();
        ctx.moveTo(x - 25, y);
        ctx.lineTo(x + 15, y);
        ctx.lineTo(x + 10, y - 5);
        ctx.moveTo(x + 15, y);
        ctx.lineTo(x + 10, y + 5);
        ctx.stroke();
        break;
    }
  }

  getTextFontByStyle = (style) => {
    switch (style) {
      case 'heading': return 'bold 18px Arial';
      case 'bullet': return '16px Arial';
      case 'quote': return 'italic 16px Arial';
      case 'definition': return '16px Arial';
      default: return '16px Arial';
    }
  }

  drawAvatar(ctx, width, height, element) {
    // ALWAYS use actual coordinates if available - this is the fix!
    let position;
    if (element.x !== undefined && element.y !== undefined) {
      position = { x: element.x, y: element.y };
    } else {
      // Fallback to center if no coordinates
      position = { x: width/2, y: height/2 };
    }
    const avatarSize = 120;
    
    // Draw avatar background
    ctx.fillStyle = '#b8daff';
    ctx.beginPath();
    ctx.arc(position.x, position.y, avatarSize / 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw avatar emoji
    ctx.font = `${avatarSize * 0.6}px Arial`;
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Determine emoji based on emotion
    let emoji = '👤';
    switch(element.emotion) {
      case 'happy': emoji = '😊'; break;
      case 'serious': emoji = '😐'; break;
      case 'thoughtful': emoji = '🤔'; break;
      default: emoji = '👤';
    }
    
    ctx.fillText(emoji, position.x, position.y);
  }

  drawImage(ctx, width, height, element) {
    // ALWAYS use actual coordinates if available - this is the fix!
    let position;
    if (element.x !== undefined && element.y !== undefined) {
      position = { x: element.x, y: element.y };
    } else {
      // Fallback to center if no coordinates
      position = { x: width/2, y: height/2 };
    }
    let imgWidth, imgHeight;
    
    switch(element.position) {
      case 'full':
        imgWidth = width - 40;
        imgHeight = height * 0.5;
        position.x = width / 2;
        position.y = height * 0.3;
        break;
      case 'left':
        imgWidth = width * 0.45;
        imgHeight = height * 0.4;
        position.x = width * 0.25;
        position.y = height * 0.3;
        break;
      case 'right':
        imgWidth = width * 0.45;
        imgHeight = height * 0.4;
        position.x = width * 0.75;
        position.y = height * 0.3;
        break;
      case 'background':
        imgWidth = width;
        imgHeight = height;
        position.x = width / 2;
        position.y = height / 2;
        break;
      default:
        imgWidth = width * 0.4;
        imgHeight = height * 0.3;
    }
    
    // Draw placeholder image asset if loaded; fallback to gray box
    if (this.scenePlaceholderLoaded) {
      ctx.drawImage(
        this.scenePlaceholderImage,
        position.x - imgWidth/2,
        position.y - imgHeight/2,
        imgWidth,
        imgHeight
      );
    } else {
      ctx.fillStyle = '#e5e7eb';
      ctx.fillRect(position.x - imgWidth/2, position.y - imgHeight/2, imgWidth, imgHeight);
    }
  }

  drawText(ctx, width, height, element) {
    // Use custom position if available, otherwise use preset position
    let position;
    if (element.position === 'custom' && element.customX !== undefined && element.customY !== undefined) {
      position = { x: element.customX, y: element.customY };
    } else {
      position = this.getPositionCoordinates(element.position, width, height);
    }
    const content = element.content || 'Text content';
    const maxWidth = width * 0.7;
    
    // Draw text background
    ctx.fillStyle = 'rgba(255, 243, 205, 0.8)';
    
    // Calculate text dimensions
    ctx.font = this.getTextFontByStyle(element.style);
    const metrics = ctx.measureText(content);
    const textHeight = this.getTextHeightByStyle(element.style);
    const textWidth = Math.min(metrics.width + 20, maxWidth);
    
    ctx.fillRect(position.x - textWidth/2, position.y - textHeight/2, textWidth, textHeight);
    
    // Draw text
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Handle multi-line text
    const words = content.split(' ');
    let line = '';
    const lines = [];
    
    words.forEach(word => {
      const testLine = line + word + ' ';
      if (ctx.measureText(testLine).width > maxWidth - 20) {
        lines.push(line);
        line = word + ' ';
      } else {
        line = testLine;
      }
    });
    lines.push(line);
    
    const lineHeight = textHeight / Math.max(lines.length, 1);
    lines.forEach((line, idx) => {
      const yPos = position.y - (textHeight/2) + (idx + 0.5) * lineHeight;
      ctx.fillText(line, position.x, yPos);
    });
  }

  drawShape(ctx, width, height, element) {
    // Use custom position if available, otherwise use preset position
    let position;
    if (element.position === 'custom' && element.customX !== undefined && element.customY !== undefined) {
      position = { x: element.customX, y: element.customY };
    } else {
      position = this.getPositionCoordinates(element.position, width, height);
    }
    ctx.fillStyle = 'rgba(220, 53, 69, 0.3)';
    ctx.strokeStyle = 'rgba(220, 53, 69, 0.7)';
    ctx.lineWidth = 2;
    
    switch(element.shape_type) {
      case 'arrow':
        ctx.beginPath();
        ctx.moveTo(position.x - 25, position.y);
        ctx.lineTo(position.x + 15, position.y);
        ctx.lineTo(position.x + 15, position.y - 10);
        ctx.lineTo(position.x + 25, position.y);
        ctx.lineTo(position.x + 15, position.y + 10);
        ctx.lineTo(position.x + 15, position.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      case 'rectangle':
        ctx.fillRect(position.x - 25, position.y - 15, 50, 30);
        ctx.strokeRect(position.x - 25, position.y - 15, 50, 30);
        break;
      case 'circle':
        ctx.beginPath();
        ctx.arc(position.x, position.y, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      case 'line':
        ctx.beginPath();
        ctx.moveTo(position.x - 40, position.y);
        ctx.lineTo(position.x + 40, position.y);
        ctx.stroke();
        break;
      case 'star':
        this.drawStar(ctx, position.x, position.y, 5, 20, 10);
        break;
      default:
        ctx.fillRect(position.x - 20, position.y - 20, 40, 40);
    }
  }

  drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
    let rot = Math.PI / 2 * 3;
    let x = cx;
    let y = cy;
    let step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  getPositionCoordinates(position, width, height) {
    switch(position) {
      case 'left':
        return { x: width * 0.25, y: height * 0.4 };
      case 'right':
        return { x: width * 0.75, y: height * 0.4 };
      case 'top':
        return { x: width * 0.5, y: height * 0.2 };
      case 'bottom':
        return { x: width * 0.5, y: height * 0.7 };
      case 'middle':
      case 'center':
      default:
        return { x: width * 0.5, y: height * 0.4 };
    }
  }

  getTextFontByStyle(style) {
    switch(style) {
      case 'heading': return 'bold 24px Arial';
      case 'bullet': return '16px Arial';
      case 'quote': return 'italic 18px Arial';
      case 'definition': return 'bold 18px Arial';
      default: return '18px Arial';
    }
  }

  getTextHeightByStyle(style) {
    switch(style) {
      case 'heading': return 40;
      case 'bullet': return 30;
      case 'quote': return 35;
      case 'definition': return 35;
      default: return 35;
    }
  }

  togglePlayPause = () => {
    this.setState(prevState => ({ isPlaying: !prevState.isPlaying }), () => {
      if (this.state.isPlaying) {
        this.startAnimation();
      } else if (this.animationRef) {
        cancelAnimationFrame(this.animationRef);
        this.stopVoiceOver();
      }
    });
  }

  startAnimation = () => {
    const startTime = Date.now();
    const { currentSection, currentScene } = this.state;
    const section = this.state.course.sections[currentSection];
    
    if (!section || !section.scenes) return;
    
    const scene = section.scenes[currentScene];
    const duration = this.estimateSceneDuration(scene) * 1000; // ms
    // Start voiceover for this scene
    this.startVoiceOver(scene);
    
    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      this.setState({ progress: progress * 100 });
      
      if (progress < 1) {
        this.animationRef = requestAnimationFrame(animate);
      } else {
        this.stopVoiceOver();
        this.nextScene();
      }
    };
    
    this.animationRef = requestAnimationFrame(animate);
  }

  nextScene = () => {
    const { currentSection, currentScene } = this.state;
    const section = this.state.course.sections[currentSection];
    
    if (!section || !section.scenes) return;
    
    if (currentScene < section.scenes.length - 1) {
      this.setState({ currentScene: currentScene + 1, progress: 0 }, () => {
        this.drawCurrentScene();
        if (this.state.isPlaying) {
          this.startAnimation();
        }
      });
    } else if (currentSection < this.props.course.sections.length - 1) {
      this.setState({ 
        currentSection: currentSection + 1, 
        currentScene: 0,
        progress: 0 
      }, () => {
        this.drawCurrentScene();
        if (this.state.isPlaying) {
          this.startAnimation();
        }
      });
    } else {
      this.setState({ isPlaying: false, progress: 0 });
    }
  }

  prevScene = () => {
    const { currentSection, currentScene } = this.state;
    
    if (currentScene > 0) {
      this.setState({ currentScene: currentScene - 1, progress: 0 }, () => {
        this.drawCurrentScene();
      });
    } else if (currentSection > 0) {
      const prevSection = this.props.course.sections[currentSection - 1];
      const lastSceneIndex = prevSection.scenes ? prevSection.scenes.length - 1 : 0;
      
      this.setState({ 
        currentSection: currentSection - 1, 
        currentScene: lastSceneIndex,
        progress: 0 
      }, () => {
        this.drawCurrentScene();
      });
    }
  }

  selectScene = (sectionIndex, sceneIndex) => {
    console.log('Selecting scene:', { sectionIndex, sceneIndex });
    this.setState({ 
      currentSection: sectionIndex,
      currentScene: sceneIndex,
      isPlaying: false,
      progress: 0
    }, () => {
      console.log('State updated, drawing scene');
      // Force a small delay to ensure state is fully updated
      setTimeout(() => {
        this.drawCurrentScene();
      }, 10);
    });
    // Stop narration when manually switching
    this.stopVoiceOver();
  }
  
  editCurrentScene = () => {
    const { currentSection, currentScene } = this.state;
    const section = this.props.course.sections[currentSection];
    const scene = section && section.scenes && section.scenes[currentScene];
    
    if (scene) {
      this.openSceneEditor(scene, currentSection, currentScene);
    }
  }
  
  openSceneEditor = (scene, sectionIndex, sceneIndex) => {
    // Use the openSceneEditor function from scene-editor.js
    if (typeof openSceneEditor === 'function') {
      openSceneEditor(scene, (updatedScene) => {
        this.updateScene(updatedScene, sectionIndex, sceneIndex);
      }, {
        // Pass the current course player instance so the scene editor can get updated scenes
        coursePlayer: this,
        sectionIndex: sectionIndex,
        sceneIndex: sceneIndex
      });
    }
  }
  
  updateScene = (updatedScene, sectionIndex, sceneIndex) => {
    // Create a deep copy of the course
    const updatedCourse = JSON.parse(JSON.stringify(this.state.course));
    
    // Update the specific scene
    updatedCourse.sections[sectionIndex].scenes[sceneIndex] = updatedScene;
    
    // If there's an onCourseUpdate callback, call it
    this.setState({ course: updatedCourse }, () => {
      if (this.props.onCourseUpdate) {
        this.props.onCourseUpdate(updatedCourse);
      }
      this.calculateTotalScenes();
      this.drawCurrentScene();
    });
  }
  
  
  
  
  playSceneWithAnimation = (scene, sectionIndex, sceneIndex, onComplete) => {
    const canvas = this.canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    
    // Get scene duration (estimated if not provided)
    const duration = this.estimateSceneDuration(scene) * 1000; // ms
    // Start voiceover for this scene
    this.startVoiceOver(scene);
    
    // Determine animation type
    let animationType = 'fadeIn'; // default
    if (scene.animation) {
      animationType = scene.animation;
    }
    
    // Start animation
    const startTime = Date.now();
    
    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Clear canvas
      ctx.clearRect(0, 0, width, height);
      
      // Get scene type colors
      const bgColors = this.getBackgroundColorsForScene(scene.scene_type);
      
    // Draw image background if mapped for this scene; otherwise gradient
    const flatIndex = this.getFlatSceneIndex(sectionIndex, sceneIndex);
    const bgImg = this.sceneImageMap[flatIndex];
    if (bgImg) {
      // cover strategy
      const imgRatio = bgImg.width / bgImg.height;
      const canvasRatio = width / height;
      let drawW, drawH;
      if (imgRatio > canvasRatio) {
        drawH = height;
        drawW = imgRatio * drawH;
      } else {
        drawW = width;
        drawH = drawW / imgRatio;
      }
      const dx = (width - drawW) / 2;
      const dy = (height - drawH) / 2;
      ctx.drawImage(bgImg, dx, dy, drawW, drawH);
    } else {
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, bgColors[0]);
      gradient.addColorStop(1, bgColors[1]);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    }
      
      // Apply animation effects
      switch (animationType) {
        case 'fadeIn':
          ctx.globalAlpha = progress;
          break;
        case 'slideIn':
          // Will be handled in element drawing
          break;
        case 'pulse':
          ctx.globalAlpha = 0.5 + 0.5 * Math.sin(progress * Math.PI * 4);
          break;
        case 'bounce':
          // Will be handled in element drawing
          break;
      }
      
      // Draw visual elements with animation
      if (scene.visual_elements) {
        scene.visual_elements.forEach(element => {
          this.drawAnimatedElement(ctx, width, height, element, animationType, progress);
        });
      }
      
      // Draw scene narration at bottom
      ctx.globalAlpha = Math.min(1, progress * 2); // Fade in text faster
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, height - 80, width, 80);
      
      ctx.font = '16px Arial';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Split narration into lines
      const narration = scene.narration || '';
      const words = narration.split(' ');
      let line = '';
      const lines = [];
      const maxLineWidth = width - 40;
      
      words.forEach(word => {
        const testLine = line + word + ' ';
        if (ctx.measureText(testLine).width > maxLineWidth) {
          lines.push(line);
          line = word + ' ';
        } else {
          line = testLine;
        }
      });
      lines.push(line);
      
      // Display up to 2 lines
      lines.slice(0, 2).forEach((line, idx) => {
        ctx.fillText(line, width / 2, height - 50 + idx * 20);
      });
      
      if (lines.length > 2) {
        ctx.fillText('...', width / 2, height - 10);
      }
      
      // Reset global alpha
      ctx.globalAlpha = 1.0;
      
      // Continue animation or complete
      if (progress < 1) {
        this.videoAnimationRef = requestAnimationFrame(animate);
      } else {
        // Add a small delay before moving to the next scene
        this.stopVoiceOver();
        setTimeout(onComplete, 500);
      }
    };
    
    this.videoAnimationRef = requestAnimationFrame(animate);
  }

  getFlatSceneIndex(sectionIndex, sceneIndex) {
    const course = this.props.course;
    if (!course || !Array.isArray(course.sections)) return 0;
    let count = 0;
    for (let i = 0; i < course.sections.length; i++) {
      const sec = course.sections[i];
      if (!Array.isArray(sec.scenes)) continue;
      if (i < sectionIndex) {
        count += sec.scenes.length;
      } else if (i === sectionIndex) {
        count += sceneIndex;
        break;
      }
    }
    return count;
  }

  startVoiceOver(scene) {
    try {
      if (!this.state.voiceOverEnabled) return;
      if (!scene || !scene.narration) return;
      if (!('speechSynthesis' in window)) return;
      // cancel prior
      this.stopVoiceOver();
      const utter = new SpeechSynthesisUtterance(scene.narration);
      if (this.selectedVoice) utter.voice = this.selectedVoice;
      utter.rate = 0.9; // Slightly slower for more natural speech
      utter.pitch = 1.1; // Slightly higher pitch
      utter.volume = 1.0;
      // Add pauses for better flow
      utter.text = scene.narration.replace(/\./g, '. ').replace(/,/g, ', ');
      this.currentUtterance = utter;
      window.speechSynthesis.speak(utter);
    } catch (e) {
      console.warn('TTS error', e);
    }
  }

  stopVoiceOver() {
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      this.currentUtterance = null;
    } catch (_) {}
  }
  
  drawAnimatedElement = (ctx, width, height, element, animationType, progress) => {
    if (!element) return;
    
    // Get base position - use custom position if available, otherwise use preset position
    let posX, posY;
    if (element.position === 'custom' && element.customX !== undefined && element.customY !== undefined) {
      posX = element.customX;
      posY = element.customY;
    } else {
      const basePosition = this.getPositionCoordinates(element.position || 'center', width, height);
      posX = basePosition.x;
      posY = basePosition.y;
    }
    
    // Apply animation effects to position
    switch (animationType) {
      case 'slideIn':
        if (element.type === 'avatar') {
          const startX = -50; // start off-screen
          posX = startX + (basePosition.x - startX) * progress;
        } else if (element.type === 'text') {
          const startX = width + 50; // start off-screen to the right
          posX = startX - (startX - basePosition.x) * progress;
        }
        break;
      case 'bounce':
        if (element.type === 'avatar') {
          posY = basePosition.y - 20 * Math.abs(Math.sin(progress * Math.PI * 3));
        }
        break;
    }
    
    // Draw the element with the animated position
    switch (element.type) {
      case 'avatar':
        this.drawAvatarAt(ctx, posX, posY, element);
        break;
      case 'text':
        this.drawTextAt(ctx, posX, posY, element);
        break;
      case 'image':
        this.drawImageAt(ctx, posX, posY, element);
        break;
      case 'shape':
        this.drawShapeAt(ctx, posX, posY, element);
        break;
    }
  }
  
  drawAvatarAt = (ctx, x, y, element) => {
    const avatarSize = 120;
    
    // Draw avatar background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.arc(x, y, avatarSize / 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw avatar emoji
    ctx.font = `${avatarSize * 0.6}px Arial`;
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Use emoji if provided, otherwise use default based on emotion
    if (element.emoji) {
      ctx.fillText(element.emoji, x, y);
    } else {
      let emoji = '👤'; // default
      switch (element.emotion) {
        case 'happy': emoji = '😊'; break;
        case 'serious': emoji = '😐'; break;
        case 'thoughtful': emoji = '🤔'; break;
      }
      ctx.fillText(emoji, x, y);
    }
  }
  
  drawTextAt = (ctx, x, y, element) => {
    const content = element.content || '';
    const maxWidth = 300;
    
    // Draw text background
    ctx.fillStyle = 'rgba(255, 243, 205, 0.8)';
    ctx.fillRect(x - maxWidth/2, y - 20, maxWidth, 40);
    
    // Draw text
    ctx.font = this.getTextFontByStyle(element.style);
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(content, x, y);
  }
  
  drawText = (ctx, width, height, element) => {
    // ALWAYS use actual coordinates if available - this is the fix!
    let position;
    if (element.x !== undefined && element.y !== undefined) {
      position = { x: element.x, y: element.y };
    } else {
      // Fallback to center if no coordinates
      position = { x: width/2, y: height/2 };
    }
    
    const content = element.content || 'Text';
    const fontSize = element.font_size || 16;
    const color = element.color || '#000000';
    const backgroundColor = element.background_color || 'transparent';
    
    // Draw background if specified
    if (backgroundColor !== 'transparent') {
      ctx.fillStyle = backgroundColor;
      const textWidth = ctx.measureText(content).width;
      const padding = 10;
      ctx.fillRect(position.x - textWidth/2 - padding, position.y - fontSize/2 - padding, textWidth + padding*2, fontSize + padding*2);
    }
    
    // Draw text
    ctx.font = `${fontSize}px Arial`;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(content, position.x, position.y);
  }

  drawShape = (ctx, width, height, element) => {
    // ALWAYS use actual coordinates if available - this is the fix!
    let position;
    if (element.x !== undefined && element.y !== undefined) {
      position = { x: element.x, y: element.y };
    } else {
      // Fallback to center if no coordinates
      position = { x: width/2, y: height/2 };
    }
    
    const shapeType = element.shape_type || 'rectangle';
    const shapeWidth = element.width || 100;
    const shapeHeight = element.height || 50;
    const color = element.color || '#3b82f6';
    
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    
    switch (shapeType) {
      case 'rectangle':
        ctx.fillRect(position.x - shapeWidth/2, position.y - shapeHeight/2, shapeWidth, shapeHeight);
        break;
      case 'circle':
        ctx.beginPath();
        ctx.arc(position.x, position.y, shapeWidth/2, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'arrow':
        ctx.beginPath();
        ctx.moveTo(position.x - shapeWidth/2, position.y);
        ctx.lineTo(position.x + shapeWidth/2, position.y);
        ctx.moveTo(position.x + shapeWidth/2 - 10, position.y - 5);
        ctx.lineTo(position.x + shapeWidth/2, position.y);
        ctx.lineTo(position.x + shapeWidth/2 - 10, position.y + 5);
        ctx.stroke();
        break;
      default:
        ctx.fillRect(position.x - shapeWidth/2, position.y - shapeHeight/2, shapeWidth, shapeHeight);
    }
  }

  drawImageAt = (ctx, x, y, element) => {
    const imgWidth = 200;
    const imgHeight = 150;
    
    // Check if this is a video snapshot (main visual element)
    if (element.is_video_snapshot) {
      // Draw the actual video snapshot (large, main element)
      if (element.image_data) {
        const img = new Image();
        img.onload = () => {
          // Redraw the canvas when image loads
          this.drawCurrentScene();
        };
        img.src = element.image_data;
        
        // Use the element's actual dimensions for video snapshots
        const actualWidth = element.width || imgWidth;
        const actualHeight = element.height || imgHeight;
        
        // Draw the image at its specified size
        ctx.drawImage(img, x - actualWidth/2, y - actualHeight/2, actualWidth, actualHeight);
        
        // Add a very subtle border to indicate it's a video snapshot
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x - actualWidth/2, y - actualHeight/2, actualWidth, actualHeight);
      } else {
        // Fallback for video snapshots without data
        const actualWidth = element.width || imgWidth;
        const actualHeight = element.height || imgHeight;
        ctx.fillStyle = 'rgba(16, 185, 129, 0.3)';
        ctx.fillRect(x - actualWidth/2, y - actualHeight/2, actualWidth, actualHeight);
        ctx.fillStyle = '#000000';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🎬', x, y - 15);
        ctx.font = '14px Arial';
        ctx.fillText('Video Frame', x, y + 15);
      }
    } else {
      // Regular image element - use placeholder or actual image
      if (this.scenePlaceholderLoaded) {
        ctx.drawImage(this.scenePlaceholderImage, x - imgWidth/2, y - imgHeight/2, imgWidth, imgHeight);
      } else {
        ctx.fillStyle = '#e5e7eb';
        ctx.fillRect(x - imgWidth/2, y - imgHeight/2, imgWidth, imgHeight);
      }
    }
  }
  
  drawShapeAt = (ctx, x, y, element) => {
    ctx.fillStyle = 'rgba(220, 53, 69, 0.3)';
    ctx.strokeStyle = 'rgba(220, 53, 69, 0.7)';
    ctx.lineWidth = 2;
    
    switch(element.shape_type) {
      case 'arrow':
        ctx.beginPath();
        ctx.moveTo(x - 25, y);
        ctx.lineTo(x + 15, y);
        ctx.lineTo(x + 15, y - 10);
        ctx.lineTo(x + 25, y);
        ctx.lineTo(x + 15, y + 10);
        ctx.lineTo(x + 15, y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      case 'rectangle':
        ctx.fillRect(x - 25, y - 15, 50, 30);
        ctx.strokeRect(x - 25, y - 15, 50, 30);
        break;
      case 'circle':
        ctx.beginPath();
        ctx.arc(x, y, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      default:
        ctx.fillRect(x - 20, y - 20, 40, 40);
    }
  }
  
  getTextFontByStyle(style) {
    switch(style) {
      case 'heading': return 'bold 24px Arial';
      case 'bullet': return '16px Arial';
      case 'quote': return 'italic 18px Arial';
      case 'definition': return 'bold 18px Arial';
      default: return '18px Arial';
    }
  }
  
  getBackgroundColorsForScene(sceneType) {
    switch(sceneType) {
      case 'introduction':
        return ['#3b82f6', '#2563eb']; // blue
      case 'content':
        return ['#10b981', '#059669']; // green
      case 'summary':
        return ['#f59e0b', '#d97706']; // amber
      case 'question':
        return ['#ec4899', '#db2777']; // pink
      case 'explanation':
        return ['#8b5cf6', '#7c3aed']; // purple
      case 'instruction':
        return ['#6366f1', '#4f46e5']; // indigo
      case 'emphasis':
        return ['#ef4444', '#dc2626']; // red
      default:
        return ['#3b82f6', '#2563eb']; // blue
    }
  }

  drawQuizSection(ctx, width, height, section) {
    // Draw background (quiz theme - purple gradient)
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#8b5cf6');
    gradient.addColorStop(1, '#7c3aed');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // Draw quiz icon/emoji
    ctx.font = '80px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillText('📝', width / 2, height * 0.3);
    
    // Draw quiz title
    ctx.font = 'bold 32px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(section.title || 'Quiz Section', width / 2, height * 0.45);
    
    // Draw quiz description
    ctx.font = '18px Arial';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.textAlign = 'center';
    const questionCount = section.questions ? section.questions.length : 0;
    ctx.fillText(`${questionCount} questions to test your understanding`, width / 2, height * 0.55);
    
    // Draw quiz status
    const { currentSection } = this.state;
    const hasPassed = this.hasPassedQuiz(currentSection);
    
    if (hasPassed) {
      ctx.font = 'bold 24px Arial';
      ctx.fillStyle = '#10b981';
      ctx.fillText('✓ Quiz Completed', width / 2, height * 0.7);
      
      const result = this.state.quizResults[currentSection];
      if (result) {
        ctx.font = '18px Arial';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillText(`Score: ${result.score}/${result.total} (${result.percentage}%)`, width / 2, height * 0.75);
      }
    } else {
      ctx.font = 'bold 24px Arial';
      ctx.fillStyle = '#fbbf24';
      ctx.fillText('Click "Take Quiz" to begin', width / 2, height * 0.7);
    }
    
    // Draw instruction text
    ctx.font = '16px Arial';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText('Use the sidebar to start the quiz', width / 2, height * 0.85);
  }

  // Quiz-related methods
  openQuiz = (sectionIndex) => {
    const section = this.state.course.sections[sectionIndex];
    if (section && section.type === 'quiz' && section.questions) {
      this.setState({
        isQuizOpen: true,
        currentQuiz: {
          ...section,
          sectionIndex: sectionIndex
        }
      });
    }
  }

  closeQuiz = () => {
    this.setState({
      isQuizOpen: false,
      currentQuiz: null
    });
  }

  handleQuizComplete = (score, totalQuestions) => {
    const { currentQuiz } = this.state;
    const percentage = Math.round((score / totalQuestions) * 100);
    const isPassing = percentage >= 70; // 70% passing score
    
    this.setState(prevState => ({
      quizResults: {
        ...prevState.quizResults,
        [currentQuiz.sectionIndex]: {
          score: score,
          total: totalQuestions,
          percentage: percentage,
          passed: isPassing
        }
      }
    }));
  }

  handleQuizContinue = () => {
    this.closeQuiz();
    // Auto-advance to next section after passing quiz
    this.nextSection();
  }

  getCurrentScene = () => {
    const { currentSection, currentScene } = this.state;
    const section = this.state.course.sections[currentSection];
    if (section && section.scenes && section.scenes[currentScene]) {
      return section.scenes[currentScene];
    }
    return null;
  }



  nextSection = () => {
    const { currentSection } = this.state;
    const { course } = this.props;
    
    if (currentSection < course.sections.length - 1) {
      this.setState({
        currentSection: currentSection + 1,
        currentScene: 0,
        progress: 0
      }, () => {
        this.drawCurrentScene();
      });
    }
  }

  isQuizSection = (sectionIndex) => {
    const section = this.state.course.sections[sectionIndex];
    return section && section.type === 'quiz';
  }

  hasPassedQuiz = (sectionIndex) => {
    const result = this.state.quizResults[sectionIndex];
    return result && result.passed;
  }

  render() {
    const { course } = this.props;
    const { 
      currentSection, 
      currentScene, 
      isPlaying, 
      progress, 
      videoMode,
      videoProgress,
      totalScenes 
    } = this.state;
    
    if (!course || !course.sections) {
      return (
        <div className="text-center p-4">
          <p>No course data available</p>
        </div>
      );
    }

    const section = course.sections[currentSection];
    const scene = section && section.scenes && section.scenes[currentScene];
    
    return (
      <div className="course-player">
        {/* Role Toggle */}
        <div className="flex items-center justify-end mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">View as:</span>
            <div className="inline-flex rounded border border-gray-300 overflow-hidden">
              <button
                className={`px-3 py-1 text-sm ${this.state.role === 'learner' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700'}`}
                onClick={() => this.setState({ role: 'learner' }, () => this.drawCurrentScene())}
              >Learner</button>
              <button
                className={`px-3 py-1 text-sm ${this.state.role === 'author' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700'}`}
                onClick={() => this.setState({ role: 'author' }, () => this.drawCurrentScene())}
              >Author</button>
            </div>
          </div>
        </div>
        <div className="player-header mb-4">
          <h2 className="text-2xl font-bold">{course.title}</h2>
          <p className="text-gray-600">{course.description}</p>
          
          <div className="flex mt-4 gap-2">
            <button
              onClick={() => {
                const next = !this.state.voiceOverEnabled;
                this.setState({ voiceOverEnabled: next });
                if (!next) this.stopVoiceOver();
              }}
              className={`px-4 py-2 rounded ${this.state.voiceOverEnabled ? 'bg-green-600 text-white' : 'bg-gray-600 text-white'}`}
              title="Toggle voice over narration"
            >
              {this.state.voiceOverEnabled ? 'Voice Over: On' : 'Voice Over: Off'}
            </button>
          </div>
        </div>
        
        <div className="player-main grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <div 
                className="player-canvas-container bg-gray-900 rounded-lg overflow-hidden relative"
                onMouseEnter={() => this.setState({ isCanvasHovered: true })}
                onMouseLeave={() => this.setState({ isCanvasHovered: false })}
              >
                <canvas 
                  ref={this.canvasRef}
                  width={1280}
                  height={720}
                  className="w-full"
                />
                
                <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4 transition-opacity duration-300 ${this.state.isCanvasHovered ? 'opacity-100' : 'opacity-0'}`}>
                  <div className="w-full bg-gray-700 rounded-full h-2 mb-3">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  
                  <div className="flex items-center justify-center gap-4">
                    <button
                      onClick={this.prevScene}
                      className="bg-gray-600 hover:bg-gray-700 text-white p-2 rounded-full transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="19 20 9 12 19 4 19 20"></polygon>
                        <line x1="5" y1="19" x2="5" y2="5"></line>
                      </svg>
                    </button>
                    
                    <button
                      onClick={this.togglePlayPause}
                      className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full transition-colors"
                    >
                      {isPlaying ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="6" y="4" width="4" height="16"></rect>
                          <rect x="14" y="4" width="4" height="16"></rect>
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="5 3 19 12 5 21 5 3"></polygon>
                        </svg>
                      )}
                    </button>
                    
                    <button
                      onClick={this.nextScene}
                      className="bg-gray-600 hover:bg-gray-700 text-white p-2 rounded-full transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="5 4 15 12 5 20 5 4"></polygon>
                        <line x1="19" y1="5" x2="19" y2="19"></line>
                      </svg>
                    </button>
                    
                    {this.state.role === 'author' && (
                      <button
                        onClick={this.editCurrentScene}
                        className="bg-green-600 hover:bg-green-700 text-white p-2 rounded-full transition-colors"
                        title="Edit Scene"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
              
              {scene && (
                <div className="mt-4 bg-white p-4 rounded-lg shadow">
                  <h3 className="font-bold text-lg mb-2">Current Scene</h3>
                  <p className="text-gray-700">{scene.narration}</p>
                  
                  {scene.visual_elements && scene.visual_elements.length > 0 && (
                    <div className="mt-3">
                      <h4 className="font-semibold text-sm text-gray-600 mb-2">Visual Elements:</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {scene.visual_elements.map((element, idx) => (
                          <div key={idx} className={`p-2 rounded bg-gray-100 text-sm`}>
                            <div className="font-medium">{element.type}</div>
                            {element.type === 'text' && <div>{element.content}</div>}
                            {element.type === 'image' && <div>{element.description}</div>}
                            {element.type === 'avatar' && (
                              <div>
                                {element.emoji && <span className="text-xl mr-2">{element.emoji}</span>}
                                {element.emotion} {element.style}
                              </div>
                            )}
                            {element.type === 'shape' && <div>{element.shape_type}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="scenes-sidebar">
              <div className="bg-white p-4 rounded-lg shadow">
                <h3 className="font-bold text-lg mb-3">Course Sections</h3>
                
                <div className="space-y-4">
                  {course.sections.map((section, sectionIdx) => (
                    <div key={sectionIdx} className="border rounded-lg overflow-hidden">
                      <div className={`p-3 ${currentSection === sectionIdx ? 'bg-blue-100' : 'bg-gray-100'}`}>
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">{section.title}</h4>
                          {this.isQuizSection(sectionIdx) && (
                            <div className="flex items-center gap-2">
                              {this.hasPassedQuiz(sectionIdx) ? (
                                <span className="text-green-600 text-sm font-medium">✓ Passed</span>
                              ) : (
                                <button
                                  onClick={() => this.openQuiz(sectionIdx)}
                                  className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors"
                                >
                                  Take Quiz
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {section.scenes && (
                        <div className="divide-y">
                          {section.scenes.map((scene, sceneIdx) => (
                            <div 
                              key={sceneIdx}
                              className={`p-2 pl-4 cursor-pointer hover:bg-gray-50 ${
                                currentSection === sectionIdx && currentScene === sceneIdx ? 'bg-blue-50' : ''
                              }`}
                              onClick={() => this.selectScene(sectionIdx, sceneIdx)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                  <div className={`w-2 h-2 rounded-full mr-2 ${
                                    scene.scene_type === 'introduction' ? 'bg-blue-500' :
                                    scene.scene_type === 'content' ? 'bg-green-500' :
                                    scene.scene_type === 'summary' ? 'bg-red-500' : 
                                    scene.scene_type === 'explanation' ? 'bg-purple-500' :
                                    scene.scene_type === 'instruction' ? 'bg-indigo-500' :
                                    scene.scene_type === 'emphasis' ? 'bg-red-500' :
                                    scene.scene_type === 'question' ? 'bg-pink-500' :
                                    'bg-gray-500'
                                  }`}></div>
                                  <span className="text-sm">Scene {sceneIdx + 1}: {scene.scene_type || 'Content'}</span>
                                </div>
                                {this.state.role === 'author' && (
                                  <button 
                                    className="text-blue-500 hover:text-blue-700 p-1"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      this.openSceneEditor(scene, sectionIdx, sceneIdx);
                                    }}
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                                    </svg>
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quiz Modal */}
        {this.state.isQuizOpen && this.state.currentQuiz && (
          <QuizModal
            isOpen={this.state.isQuizOpen}
            onClose={this.closeQuiz}
            questions={this.state.currentQuiz.questions}
            title={this.state.currentQuiz.title}
            timeLimit={300} // 5 minutes
            passingScore={70}
            onQuizComplete={this.handleQuizComplete}
            onContinue={this.handleQuizContinue}
          />
        )}
      </div>
    );
  }
}

// Helper function to mount the React component
function mountCoursePlayer(courseData, containerId, onCourseUpdate, options) {
  const container = document.getElementById(containerId);
  if (container && courseData) {
    ReactDOM.render(
      React.createElement(CoursePlayer, { 
        course: courseData,
        onCourseUpdate: onCourseUpdate,
        role: options && options.role ? options.role : 'learner',
        videoUrl: options && options.videoUrl ? options.videoUrl : null
      }),
      container
    );
  }
}
