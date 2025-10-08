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
      selectedScene: null,
      isEditorOpen: false,
      sceneToEdit: null,
      videoMode: false,
      videoProgress: 0,
      currentVideoScene: 0,
      totalScenes: 0,
      sceneDurations: [],
      isQuizOpen: false,
      currentQuiz: null,
      quizResults: {}
    };
    this.canvasRef = React.createRef();
    this.videoCanvasRef = React.createRef();
    this.animationRef = null;
    this.videoAnimationRef = null;
  }

  componentDidMount() {
    this.drawCurrentScene();
    this.calculateTotalScenes();
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
  }

  componentWillUnmount() {
    if (this.animationRef) {
      cancelAnimationFrame(this.animationRef);
    }
    if (this.videoAnimationRef) {
      cancelAnimationFrame(this.videoAnimationRef);
    }
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
          // Default duration is 5 seconds if not specified
          sceneDurations.push(scene.duration || 5);
        });
      }
    });
    
    this.setState({ totalScenes, sceneDurations });
  }

  drawCurrentScene() {
    // Don't draw if we're in video mode
    if (this.state.videoMode) {
      console.log('In video mode, skipping drawCurrentScene');
      return;
    }

    const canvas = this.canvasRef.current;
    if (!canvas) {
      console.log('Canvas not found');
      return;
    }

    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    const { currentSection, currentScene } = this.state;
    
    // Ensure canvas is properly sized
    if (width === 0 || height === 0) {
      console.log('Canvas has zero dimensions:', { width, height });
      return;
    }
    
    // Clear canvas completely and reset context
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    
    // Debug logging
    console.log('Drawing scene:', { currentSection, currentScene, canvasSize: { width, height } });
    
    // Get current section
    const section = this.state.course.sections[currentSection];
    if (!section) {
      console.log('No section found for index:', currentSection);
      return;
    }
    
    // Handle quiz sections differently
    if (section.type === 'quiz') {
      this.drawQuizSection(ctx, width, height, section);
      return;
    }
    
    // Handle regular content sections
    if (!section.scenes || !section.scenes[currentScene]) {
      console.log('No scene found:', { sectionScenes: section.scenes, currentScene });
      return;
    }
    
    const scene = section.scenes[currentScene];
    console.log('Drawing scene data:', { sceneType: scene.scene_type, narration: scene.narration?.substring(0, 50) + '...' });
    
    // Draw background (gradient)
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#3b82f6');
    gradient.addColorStop(1, '#2563eb');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // Draw scene elements
    if (scene.visual_elements) {
      scene.visual_elements.forEach(element => {
        this.drawVisualElement(ctx, width, height, element);
      });
    }
    
    // Draw scene type and narration
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, height - 100, width, 100);
    
    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(`Scene ${currentScene + 1} - ${scene.scene_type || 'Content'}`, 20, height - 75);
    
    ctx.font = '14px Arial';
    ctx.fillStyle = '#ffffff';
    const narration = scene.narration || 'No narration available';
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
    
    // Restore context state
    ctx.restore();
  }

  drawVisualElement(ctx, width, height, element) {
    switch (element.type) {
      case 'avatar':
        this.drawAvatar(ctx, width, height, element);
        break;
      case 'image':
        this.drawImage(ctx, width, height, element);
        break;
      case 'text':
        this.drawText(ctx, width, height, element);
        break;
      case 'shape':
        this.drawShape(ctx, width, height, element);
        break;
    }
  }

  drawAvatar(ctx, width, height, element) {
    // Use custom position if available, otherwise use preset position
    let position;
    if (element.position === 'custom' && element.customX !== undefined && element.customY !== undefined) {
      position = { x: element.customX, y: element.customY };
    } else {
      position = this.getPositionCoordinates(element.position, width, height);
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
    // Use custom position if available, otherwise use preset position
    let position;
    if (element.position === 'custom' && element.customX !== undefined && element.customY !== undefined) {
      position = { x: element.customX, y: element.customY };
    } else {
      position = this.getPositionCoordinates(element.position, width, height);
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
    
    // Draw placeholder image
    ctx.fillStyle = '#c3e6cb';
    ctx.fillRect(position.x - imgWidth/2, position.y - imgHeight/2, imgWidth, imgHeight);
    
    // Draw image icon and description
    ctx.font = '24px Arial';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🖼️', position.x, position.y - 15);
    
    ctx.font = '14px Arial';
    const description = element.description || 'Image';
    const truncatedDesc = description.length > 30 ? description.substring(0, 27) + '...' : description;
    ctx.fillText(truncatedDesc, position.x, position.y + 15);
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
      }
    });
  }

  startAnimation = () => {
    const startTime = Date.now();
    const { currentSection, currentScene } = this.state;
    const section = this.state.course.sections[currentSection];
    
    if (!section || !section.scenes) return;
    
    const scene = section.scenes[currentScene];
    const duration = 5000; // 5 seconds per scene
    
    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      this.setState({ progress: progress * 100 });
      
      if (progress < 1) {
        this.animationRef = requestAnimationFrame(animate);
      } else {
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
  
  toggleVideoMode = () => {
    this.setState(prevState => ({ 
      videoMode: !prevState.videoMode,
      currentVideoScene: 0,
      videoProgress: 0
    }));
  }
  
  startVideoPlayback = () => {
    const canvas = this.videoCanvasRef.current;
    if (!canvas) return;
    
    // Reset state
    this.setState({
      currentVideoScene: 0,
      videoProgress: 0
    }, () => {
      this.playNextVideoScene();
    });
  }
  
  playNextVideoScene = () => {
    const { currentVideoScene, totalScenes, sceneDurations } = this.state;
    
    if (currentVideoScene >= totalScenes) {
      // End of video
      this.setState({ videoMode: false });
      return;
    }
    
    // Find the section and scene indices for the current video scene
    let sceneCounter = 0;
    let targetSectionIndex = 0;
    let targetSceneIndex = 0;
    let found = false;
    
    const course = this.state.course;
    
    for (let i = 0; i < course.sections.length; i++) {
      const section = course.sections[i];
      if (!section.scenes) continue;
      
      for (let j = 0; j < section.scenes.length; j++) {
        if (sceneCounter === currentVideoScene) {
          targetSectionIndex = i;
          targetSceneIndex = j;
          found = true;
          break;
        }
        sceneCounter++;
      }
      
      if (found) break;
    }
    
    if (!found) {
      // Couldn't find the scene, end playback
      this.setState({ videoMode: false });
      return;
    }
    
    // Get the scene
    const section = course.sections[targetSectionIndex];
    const scene = section.scenes[targetSceneIndex];
    
    // Play this scene with animation
    this.playSceneWithAnimation(scene, targetSectionIndex, targetSceneIndex, () => {
      // When animation is done, move to next scene
      this.setState(prevState => ({
        currentVideoScene: prevState.currentVideoScene + 1,
        videoProgress: ((prevState.currentVideoScene + 1) / totalScenes) * 100
      }), () => {
        this.playNextVideoScene();
      });
    });
  }
  
  playSceneWithAnimation = (scene, sectionIndex, sceneIndex, onComplete) => {
    const canvas = this.videoCanvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    
    // Get scene duration (default 5 seconds)
    const duration = (scene.duration || 5) * 1000; // convert to ms
    
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
      
      // Draw background gradient
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, bgColors[0]);
      gradient.addColorStop(1, bgColors[1]);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      
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
        setTimeout(onComplete, 500);
      }
    };
    
    this.videoAnimationRef = requestAnimationFrame(animate);
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
  
  drawImageAt = (ctx, x, y, element) => {
    const imgWidth = 200;
    const imgHeight = 150;
    
    ctx.fillStyle = '#c3e6cb';
    ctx.fillRect(x - imgWidth/2, y - imgHeight/2, imgWidth, imgHeight);
    
    ctx.font = '24px Arial';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🖼️', x, y - 15);
    
    ctx.font = '14px Arial';
    const description = element.description || 'Image';
    const truncatedDesc = description.length > 30 ? description.substring(0, 27) + '...' : description;
    ctx.fillText(truncatedDesc, x, y + 15);
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
        <div className="player-header mb-4">
          <h2 className="text-2xl font-bold">{course.title}</h2>
          <p className="text-gray-600">{course.description}</p>
          
          <div className="flex mt-4 gap-2">
            <button 
              onClick={this.toggleVideoMode}
              className={`px-4 py-2 rounded ${videoMode ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'}`}
            >
              {videoMode ? 'Exit Video Mode' : 'Play as Video'}
            </button>
          </div>
        </div>
        
        {videoMode ? (
          <div className="video-player mb-6">
            <div className="bg-black rounded-lg overflow-hidden relative">
              <canvas 
                ref={this.videoCanvasRef}
                width={1280}
                height={720}
                className="w-full"
              />
              
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4">
                <div className="w-full bg-gray-700 rounded-full h-2 mb-3">
                  <div
                    className="bg-red-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${videoProgress}%` }}
                  />
                </div>
                
                <div className="flex items-center justify-between px-4">
                  <div className="text-white text-sm">
                    Scene {Math.min(totalScenes, Math.floor(videoProgress / 100 * totalScenes) + 1)} of {totalScenes}
                  </div>
                  <button
                    onClick={this.toggleVideoMode}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition-colors"
                  >
                    Stop
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="player-main grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <div className="player-canvas-container bg-gray-900 rounded-lg overflow-hidden relative">
                <canvas 
                  ref={this.canvasRef}
                  width={1280}
                  height={720}
                  className="w-full"
                />
                
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4">
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
                    
                    <button
                      onClick={this.editCurrentScene}
                      className="bg-green-600 hover:bg-green-700 text-white p-2 rounded-full transition-colors"
                      title="Edit Scene"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                      </svg>
                    </button>
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
function mountCoursePlayer(courseData, containerId, onCourseUpdate) {
  const container = document.getElementById(containerId);
  if (container && courseData) {
    ReactDOM.render(
      React.createElement(CoursePlayer, { 
        course: courseData,
        onCourseUpdate: onCourseUpdate 
      }),
      container
    );
  }
}
