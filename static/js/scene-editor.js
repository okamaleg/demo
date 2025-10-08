// Scene Editor Component
class SceneEditor extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      scene: props.scene || {
        scene_type: 'content',
        narration: '',
        visual_elements: []
      },
      duration: 3.0,
      keyPhrase: '',
      selectedAvatar: '👨‍🏫',
      selectedAnimation: 'fadeIn',
      isEditing: false,
      previewMode: false,
      draggingElement: null,
      dragStartX: 0,
      dragStartY: 0,
      elementPositions: {}, // Stores custom positions for elements
      selectedElement: null,
      showElementPanel: false,
      newElementType: 'avatar'
    };
    this.canvasRef = React.createRef();
    this.animationRef = null;
  }

  componentDidMount() {
    if (this.props.scene) {
      // Initialize element positions from existing elements
      const elementPositions = {};
      if (this.props.scene.visual_elements) {
        this.props.scene.visual_elements.forEach((element, index) => {
          // If the element has custom coordinates, use them
          if (element.customX !== undefined && element.customY !== undefined) {
            elementPositions[index] = {
              x: element.customX,
              y: element.customY
            };
          }
        });
      }
      
      this.setState({
        scene: this.props.scene,
        duration: this.props.scene.duration || 3.0,
        keyPhrase: this.getKeyPhrase(this.props.scene.narration),
        elementPositions
      }, () => {
        this.drawPreview();
        this.setupCanvasEventListeners();
      });
    } else {
      this.setupCanvasEventListeners();
    }
  }
  
  setupCanvasEventListeners() {
    const canvas = this.canvasRef.current;
    if (!canvas) return;
    
    // Mouse down event for element selection and drag start
    canvas.addEventListener('mousedown', this.handleCanvasMouseDown);
    
    // Mouse move event for dragging
    canvas.addEventListener('mousemove', this.handleCanvasMouseMove);
    
    // Mouse up event for drag end
    canvas.addEventListener('mouseup', this.handleCanvasMouseUp);
    
    // Double click for editing element properties
    canvas.addEventListener('dblclick', this.handleCanvasDoubleClick);
  }
  
  componentWillUnmount() {
    if (this.animationRef) {
      cancelAnimationFrame(this.animationRef);
    }
    
    const canvas = this.canvasRef.current;
    if (canvas) {
      canvas.removeEventListener('mousedown', this.handleCanvasMouseDown);
      canvas.removeEventListener('mousemove', this.handleCanvasMouseMove);
      canvas.removeEventListener('mouseup', this.handleCanvasMouseUp);
      canvas.removeEventListener('dblclick', this.handleCanvasDoubleClick);
    }
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevProps.scene !== this.props.scene && this.props.scene) {
      this.setState({
        scene: this.props.scene,
        duration: this.props.scene.duration || 3.0,
        keyPhrase: this.getKeyPhrase(this.props.scene.narration)
      }, () => {
        this.drawPreview();
      });
    }

    if (prevState.previewMode !== this.state.previewMode && this.state.previewMode) {
      this.startPreviewAnimation();
    } else if (prevState.previewMode !== this.state.previewMode && !this.state.previewMode) {
      if (this.animationRef) {
        cancelAnimationFrame(this.animationRef);
      }
    }
  }

  componentWillUnmount() {
    if (this.animationRef) {
      cancelAnimationFrame(this.animationRef);
    }
  }

  getKeyPhrase(text) {
    if (!text) return '';
    const words = text.split(' ');
    return words.length > 8 ? words.slice(0, 5).join(' ') + '...' : text.substring(0, 50);
  }

  handleNarrationChange = (e) => {
    const narration = e.target.value;
    this.setState(prevState => ({
      scene: {
        ...prevState.scene,
        narration
      },
      keyPhrase: this.getKeyPhrase(narration)
    }));
  }

  handleDurationChange = (e) => {
    this.setState({ duration: parseFloat(e.target.value) });
  }

  handleSceneTypeChange = (type) => {
    this.setState(prevState => ({
      scene: {
        ...prevState.scene,
        scene_type: type
      }
    }), () => {
      this.drawPreview();
    });
  }

  handleAvatarSelect = (avatar) => {
    // Find if we already have an avatar element
    const { scene } = this.state;
    let updatedElements = [...(scene.visual_elements || [])];
    
    const avatarIndex = updatedElements.findIndex(el => el.type === 'avatar');
    
    if (avatarIndex >= 0) {
      // Update existing avatar
      updatedElements[avatarIndex] = {
        ...updatedElements[avatarIndex],
        emoji: avatar
      };
    } else {
      // Add new avatar
      updatedElements.push({
        type: 'avatar',
        position: 'center',
        emotion: 'neutral',
        style: 'professional',
        emoji: avatar
      });
    }
    
    this.setState(prevState => ({
      scene: {
        ...prevState.scene,
        visual_elements: updatedElements
      },
      selectedAvatar: avatar
    }), () => {
      this.drawPreview();
    });
  }

  handleAnimationSelect = (animation) => {
    this.setState({ selectedAnimation: animation }, () => {
      this.drawPreview();
    });
  }

  handleKeyPhraseChange = (e) => {
    this.setState({ keyPhrase: e.target.value });
  }

  togglePreview = () => {
    this.setState(prevState => ({ previewMode: !prevState.previewMode }));
  }

  saveScene = () => {
    const { scene, duration, keyPhrase } = this.state;
    const updatedScene = {
      ...scene,
      duration,
      keyPhrase,
      visual_elements: scene.visual_elements // Include the updated visual elements with custom positions
    };
    
    if (this.props.onSave) {
      this.props.onSave(updatedScene);
    }
  }

  // Canvas mouse event handlers
  handleCanvasMouseDown = (e) => {
    if (this.state.previewMode) return;
    
    const canvas = this.canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Scale coordinates to match canvas internal dimensions
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = x * scaleX;
    const canvasY = y * scaleY;
    
    // Find if we clicked on an element
    const elementIndex = this.findElementAt(canvasX, canvasY);
    
    if (elementIndex !== -1) {
      // Start dragging this element
      this.setState({
        draggingElement: elementIndex,
        dragStartX: canvasX,
        dragStartY: canvasY,
        selectedElement: elementIndex
      });
    } else {
      // Deselect if clicking on empty space
      this.setState({ selectedElement: null });
    }
  };
  
  handleCanvasMouseMove = (e) => {
    if (this.state.draggingElement === null || this.state.previewMode) return;
    
    const canvas = this.canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Scale coordinates to match canvas internal dimensions
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = x * scaleX;
    const canvasY = y * scaleY;
    
    // Update element position
    const elementIndex = this.state.draggingElement;
    const elementPositions = {...this.state.elementPositions};
    
    elementPositions[elementIndex] = {
      x: canvasX,
      y: canvasY
    };
    
    this.setState({ elementPositions }, () => {
      this.drawPreview();
    });
  };
  
  handleCanvasMouseUp = (e) => {
    if (this.state.draggingElement === null) return;
    
    // Update the element's position in the scene data
    const elementIndex = this.state.draggingElement;
    const position = this.state.elementPositions[elementIndex];
    
    if (position) {
      const updatedElements = [...this.state.scene.visual_elements];
      updatedElements[elementIndex] = {
        ...updatedElements[elementIndex],
        customX: position.x,
        customY: position.y,
        position: 'custom' // Mark that this element now has custom positioning
      };
      
      this.setState(prevState => ({
        scene: {
          ...prevState.scene,
          visual_elements: updatedElements
        },
        draggingElement: null
      }));
    } else {
      this.setState({ draggingElement: null });
    }
  };
  
  handleCanvasDoubleClick = (e) => {
    if (this.state.previewMode) return;
    
    const canvas = this.canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Scale coordinates to match canvas internal dimensions
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = x * scaleX;
    const canvasY = y * scaleY;
    
    // Find if we double-clicked on an element
    const elementIndex = this.findElementAt(canvasX, canvasY);
    
    if (elementIndex !== -1) {
      // Open element properties panel
      this.setState({
        selectedElement: elementIndex,
        showElementPanel: true
      });
    } else {
      // Double-click on empty space - add new element at this position
      this.addNewElementAt(canvasX, canvasY);
    }
  };
  
  findElementAt(x, y) {
    const { scene, elementPositions } = this.state;
    if (!scene.visual_elements) return -1;
    
    // Check each element in reverse order (top elements first)
    for (let i = scene.visual_elements.length - 1; i >= 0; i--) {
      const element = scene.visual_elements[i];
      
      // Get element position (either custom or default)
      let elementX, elementY;
      if (elementPositions[i]) {
        elementX = elementPositions[i].x;
        elementY = elementPositions[i].y;
      } else if (element.customX !== undefined && element.customY !== undefined) {
        elementX = element.customX;
        elementY = element.customY;
      } else {
        const position = this.getPositionCoordinates(element.position || 'center', this.canvasRef.current.width, this.canvasRef.current.height);
        elementX = position.x;
        elementY = position.y;
      }
      
      // Check if point is within element's hit area
      const hitSize = this.getElementHitSize(element);
      if (
        x >= elementX - hitSize.width/2 &&
        x <= elementX + hitSize.width/2 &&
        y >= elementY - hitSize.height/2 &&
        y <= elementY + hitSize.height/2
      ) {
        return i;
      }
    }
    
    return -1;
  }
  
  getElementHitSize(element) {
    switch(element.type) {
      case 'avatar':
        return { width: 120, height: 120 };
      case 'text':
        return { width: 300, height: 40 };
      case 'image':
        return { width: 200, height: 150 };
      case 'shape':
        return { width: 50, height: 50 };
      default:
        return { width: 50, height: 50 };
    }
  }
  
  addNewElementAt(x, y) {
    const { newElementType } = this.state;
    let newElement;
    
    switch(newElementType) {
      case 'avatar':
        newElement = {
          type: 'avatar',
          position: 'custom',
          emotion: 'neutral',
          style: 'professional',
          emoji: this.state.selectedAvatar,
          customX: x,
          customY: y
        };
        break;
      case 'text':
        newElement = {
          type: 'text',
          position: 'custom',
          content: 'New text element',
          style: 'normal',
          customX: x,
          customY: y
        };
        break;
      case 'image':
        newElement = {
          type: 'image',
          position: 'custom',
          description: 'New image',
          style: 'photo',
          customX: x,
          customY: y
        };
        break;
      case 'shape':
        newElement = {
          type: 'shape',
          shape_type: 'rectangle',
          position: 'custom',
          purpose: 'highlight',
          customX: x,
          customY: y
        };
        break;
    }
    
    // Add the new element to the scene
    const updatedElements = [...(this.state.scene.visual_elements || []), newElement];
    const newIndex = updatedElements.length - 1;
    
    this.setState(prevState => ({
      scene: {
        ...prevState.scene,
        visual_elements: updatedElements
      },
      selectedElement: newIndex
    }), () => {
      this.drawPreview();
    });
  }
  
  removeSelectedElement = () => {
    const { selectedElement, scene } = this.state;
    if (selectedElement === null || !scene.visual_elements) return;
    
    // Remove the element
    const updatedElements = [...scene.visual_elements];
    updatedElements.splice(selectedElement, 1);
    
    // Update element positions
    const updatedPositions = {...this.state.elementPositions};
    delete updatedPositions[selectedElement];
    
    // Remap remaining positions
    const newPositions = {};
    Object.keys(updatedPositions).forEach(index => {
      const numIndex = parseInt(index);
      if (numIndex > selectedElement) {
        newPositions[numIndex - 1] = updatedPositions[numIndex];
      } else if (numIndex < selectedElement) {
        newPositions[numIndex] = updatedPositions[numIndex];
      }
    });
    
    this.setState({
      scene: {
        ...scene,
        visual_elements: updatedElements
      },
      elementPositions: newPositions,
      selectedElement: null,
      showElementPanel: false
    }, () => {
      this.drawPreview();
    });
  };
  
  updateElementProperty = (property, value) => {
    const { selectedElement, scene } = this.state;
    if (selectedElement === null || !scene.visual_elements) return;
    
    // Update the element property
    const updatedElements = [...scene.visual_elements];
    updatedElements[selectedElement] = {
      ...updatedElements[selectedElement],
      [property]: value
    };
    
    this.setState(prevState => ({
      scene: {
        ...prevState.scene,
        visual_elements: updatedElements
      }
    }), () => {
      this.drawPreview();
    });
  };
  
  drawPreview() {
    const canvas = this.canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Get scene type colors
    const bgColors = this.getBackgroundColors(this.state.scene.scene_type);
    
    // Draw background gradient
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, bgColors[0]);
    gradient.addColorStop(1, bgColors[1]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // Draw visual elements
    if (this.state.scene.visual_elements) {
      this.state.scene.visual_elements.forEach((element, index) => {
        // Check if this element has a custom position from dragging
        const customPos = this.state.elementPositions[index];
        if (customPos) {
          // Draw with custom position
          this.drawElementAt(ctx, customPos.x, customPos.y, element, index === this.state.selectedElement);
        } else if (element.customX !== undefined && element.customY !== undefined) {
          // Use stored custom coordinates
          this.drawElementAt(ctx, element.customX, element.customY, element, index === this.state.selectedElement);
        } else {
          // Use standard positioning
          this.drawElement(ctx, width, height, element, index === this.state.selectedElement);
        }
      });
    }
    
    // Draw key phrase
    if (this.state.keyPhrase) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(width/2 - 150, height - 80, 300, 50);
      
      ctx.font = 'bold 16px Arial';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.state.keyPhrase, width/2, height - 55);
    }
    
    // Draw "add element" hint if no elements
    if (!this.state.scene.visual_elements || this.state.scene.visual_elements.length === 0) {
      ctx.font = 'italic 18px Arial';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Double-click to add elements', width/2, height/2);
    }
  }

  drawElement(ctx, width, height, element, isSelected = false) {
    const position = this.getPositionCoordinates(element.position || 'center', width, height);
    this.drawElementAt(ctx, position.x, position.y, element, isSelected);
  }
  
  drawElementAt(ctx, x, y, element, isSelected = false) {
    // Draw selection indicator if element is selected
    if (isSelected) {
      ctx.save();
      ctx.strokeStyle = '#00BFFF'; // Bright blue for selection
      ctx.lineWidth = 3;
      
      const hitSize = this.getElementHitSize(element);
      ctx.strokeRect(x - hitSize.width/2 - 5, y - hitSize.height/2 - 5, hitSize.width + 10, hitSize.height + 10);
      
      ctx.restore();
    }
    
    switch (element.type) {
      case 'avatar':
        this.drawAvatarAt(ctx, x, y, element);
        break;
      case 'text':
        this.drawTextAt(ctx, x, y, element);
        break;
      case 'image':
        this.drawImageAt(ctx, x, y, element);
        break;
      case 'shape':
        this.drawShapeAt(ctx, x, y, element);
        break;
    }
  }

  // ----- Drawing helpers for absolute positions -----
  drawAvatarAt(ctx, x, y, element) {
    const avatarSize = 120;
    // Background circle
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.arc(x, y, avatarSize / 2, 0, Math.PI * 2);
    ctx.fill();
    // Emoji
    ctx.font = `${avatarSize * 0.6}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const emoji = element.emoji || (element.emotion === 'happy' ? '😊' : element.emotion === 'serious' ? '😐' : element.emotion === 'thoughtful' ? '🤔' : '👤');
    ctx.fillText(emoji, x, y);
  }

  drawTextAt(ctx, x, y, element) {
    const content = element.content || 'Text content';
    const maxWidth = 300;
    // Background
    ctx.fillStyle = 'rgba(255, 243, 205, 0.8)';
    ctx.fillRect(x - maxWidth/2, y - 20, maxWidth, 40);
    // Text
    ctx.font = this.getTextFontByStyle(element.style);
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(content, x, y);
  }

  drawImageAt(ctx, x, y, element) {
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
    const truncated = description.length > 30 ? description.substring(0, 27) + '...' : description;
    ctx.fillText(truncated, x, y + 15);
  }

  drawShapeAt(ctx, x, y, element) {
    ctx.fillStyle = 'rgba(220, 53, 69, 0.3)';
    ctx.strokeStyle = 'rgba(220, 53, 69, 0.7)';
    ctx.lineWidth = 2;
    switch (element.shape_type) {
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
      case 'line':
        ctx.beginPath();
        ctx.moveTo(x - 40, y);
        ctx.lineTo(x + 40, y);
        ctx.stroke();
        break;
      case 'star':
        this.drawStar(ctx, x, y, 5, 20, 10);
        break;
      default:
        ctx.fillRect(x - 20, y - 20, 40, 40);
    }
  }

  drawAvatar(ctx, width, height, element) {
    const position = this.getPositionCoordinates(element.position || 'center', width, height);
    const avatarSize = 120;
    
    // Draw avatar background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.arc(position.x, position.y, avatarSize / 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw avatar emoji
    ctx.font = `${avatarSize * 0.6}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(element.emoji || '👤', position.x, position.y);
  }

  drawText(ctx, width, height, element) {
    const position = this.getPositionCoordinates(element.position || 'middle', width, height);
    
    ctx.fillStyle = 'rgba(255, 243, 205, 0.8)';
    ctx.fillRect(position.x - 150, position.y - 20, 300, 40);
    
    ctx.font = '16px Arial';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(element.content || 'Text content', position.x, position.y);
  }

  drawImage(ctx, width, height, element) {
    const position = this.getPositionCoordinates(element.position || 'center', width, height);
    
    ctx.fillStyle = '#c3e6cb';
    ctx.fillRect(position.x - 100, position.y - 75, 200, 150);
    
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

  drawShape(ctx, width, height, element) {
    const position = this.getPositionCoordinates(element.position || 'center', width, height);
    
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
      default:
        ctx.fillRect(position.x - 20, position.y - 20, 40, 40);
    }
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

  // Text helpers for scene editor
  getTextFontByStyle(style) {
    switch(style) {
      case 'heading': return 'bold 24px Arial';
      case 'bullet': return '16px Arial';
      case 'quote': return 'italic 18px Arial';
      case 'definition': return 'bold 18px Arial';
      default: return '18px Arial';
    }
  }

  getBackgroundColors(sceneType) {
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

  startPreviewAnimation() {
    const canvas = this.canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const startTime = Date.now();
    const duration = this.state.duration * 1000; // convert to ms
    const animation = this.state.selectedAnimation;
    
    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw background
      const bgColors = this.getBackgroundColors(this.state.scene.scene_type);
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, bgColors[0]);
      gradient.addColorStop(1, bgColors[1]);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Apply animation effects
      switch (animation) {
        case 'fadeIn':
          ctx.globalAlpha = progress;
          break;
        case 'slideIn':
          // Continue with normal drawing but we'll adjust positions
          break;
        case 'pulse':
          ctx.globalAlpha = 0.5 + 0.5 * Math.sin(progress * Math.PI * 4);
          break;
        case 'bounce':
          // Will apply to avatar position
          break;
      }
      
      // Draw visual elements with animation
      if (this.state.scene.visual_elements) {
        this.state.scene.visual_elements.forEach(element => {
          if (animation === 'slideIn' && element.type === 'avatar') {
            // Clone element and adjust position for slide in
            const animatedElement = {...element};
            const targetX = this.getPositionCoordinates(element.position || 'center', canvas.width, canvas.height).x;
            const startX = -50; // start off-screen
            animatedElement.customX = startX + (targetX - startX) * progress;
            this.drawAnimatedElement(ctx, canvas.width, canvas.height, animatedElement, animation, progress);
          } else if (animation === 'bounce' && element.type === 'avatar') {
            // Clone element and adjust position for bounce
            const animatedElement = {...element};
            const baseY = this.getPositionCoordinates(element.position || 'center', canvas.width, canvas.height).y;
            animatedElement.customY = baseY - 20 * Math.abs(Math.sin(progress * Math.PI * 3));
            this.drawAnimatedElement(ctx, canvas.width, canvas.height, animatedElement, animation, progress);
          } else {
            this.drawElement(ctx, canvas.width, canvas.height, element);
          }
        });
      }
      
      // Draw key phrase
      if (this.state.keyPhrase) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(canvas.width/2 - 150, canvas.height - 80, 300, 50);
        
        ctx.font = 'bold 16px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.state.keyPhrase, canvas.width/2, canvas.height - 55);
      }
      
      // Reset global alpha
      ctx.globalAlpha = 1.0;
      
      if (progress < 1 && this.state.previewMode) {
        this.animationRef = requestAnimationFrame(animate);
      } else {
        this.setState({ previewMode: false });
        this.drawPreview(); // Reset to normal view
      }
    };
    
    this.animationRef = requestAnimationFrame(animate);
  }

  drawAnimatedElement(ctx, width, height, element, animation, progress) {
    switch (element.type) {
      case 'avatar':
        this.drawAnimatedAvatar(ctx, width, height, element, animation, progress);
        break;
      case 'text':
      case 'image':
      case 'shape':
        this.drawElement(ctx, width, height, element);
        break;
    }
  }

  drawAnimatedAvatar(ctx, width, height, element, animation, progress) {
    let posX, posY;
    
    if (element.customX !== undefined) {
      posX = element.customX;
    } else {
      posX = this.getPositionCoordinates(element.position || 'center', width, height).x;
    }
    
    if (element.customY !== undefined) {
      posY = element.customY;
    } else {
      posY = this.getPositionCoordinates(element.position || 'center', width, height).y;
    }
    
    const avatarSize = 120;
    
    // Draw avatar background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.arc(posX, posY, avatarSize / 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw avatar emoji
    ctx.font = `${avatarSize * 0.6}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(element.emoji || '👤', posX, posY);
  }

  render() {
    const { 
      scene, 
      duration, 
      keyPhrase, 
      selectedAnimation, 
      previewMode, 
      selectedElement,
      showElementPanel,
      newElementType
    } = this.state;
    
    const sceneTypes = [
      { id: 'explanation', label: 'Explanation' },
      { id: 'instruction', label: 'Instruction' },
      { id: 'emphasis', label: 'Emphasis' },
      { id: 'question', label: 'Question' }
    ];
    
    const avatars = [
      { emoji: '👨‍🏫', label: 'Teacher' },
      { emoji: '👩‍💻', label: 'Developer' },
      { emoji: '⭐', label: 'Star' },
      { emoji: '🤔', label: 'Thinking' },
      { emoji: '💡', label: 'Idea' },
      { emoji: '🎯', label: 'Target' },
      { emoji: '🚀', label: 'Rocket' },
      { emoji: '📚', label: 'Books' }
    ];
    
    const animations = [
      { id: 'fadeIn', label: 'FadeIn' },
      { id: 'slideIn', label: 'SlideIn' },
      { id: 'pulse', label: 'Pulse' },
      { id: 'bounce', label: 'Bounce' }
    ];
    
    const elementTypes = [
      { id: 'avatar', label: 'Avatar' },
      { id: 'text', label: 'Text' },
      { id: 'image', label: 'Image' },
      { id: 'shape', label: 'Shape' }
    ];
    
    // Get the selected element if any
    const selectedElementData = selectedElement !== null && scene.visual_elements ? 
      scene.visual_elements[selectedElement] : null;
    
    return (
      <div className="scene-editor">
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-bold">Scene Preview</h3>
            <div className="flex gap-2">
              <div className="dropdown inline-block relative">
                <button className="bg-green-500 text-white px-3 py-1 rounded flex items-center">
                  <span className="mr-1">Add Element</span>
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                  </svg>
                </button>
                <ul className="dropdown-menu absolute hidden text-gray-700 pt-1 bg-white shadow-lg rounded z-10">
                  {elementTypes.map(type => (
                    <li key={type.id}>
                      <button
                        className="rounded-t bg-white hover:bg-gray-100 py-2 px-4 block whitespace-no-wrap w-full text-left"
                        onClick={() => this.setState({ newElementType: type.id })}
                      >
                        {type.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <button 
                className={`px-3 py-1 rounded text-white ${previewMode ? 'bg-red-500' : 'bg-blue-500'}`}
                onClick={this.togglePreview}
              >
                {previewMode ? 'Stop' : 'Preview'}
              </button>
            </div>
          </div>
          <div className="flex items-center mb-2 text-sm">
            <span className="text-gray-600">
              <strong>Tip:</strong> Double-click to add a new {newElementType}. Click and drag elements to reposition them.
            </span>
          </div>
          <div className="relative bg-gray-900 rounded-lg overflow-hidden">
            <canvas 
              ref={this.canvasRef}
              width={800}
              height={450}
              className="w-full"
            />
          </div>
        </div>
        
        {/* Element Properties Panel - shows when an element is selected */}
        {selectedElementData && (
          <div className="mb-4 p-4 border border-blue-200 bg-blue-50 rounded">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-bold">Edit {selectedElementData.type}</h4>
              <button 
                className="bg-red-500 text-white px-2 py-1 rounded text-sm"
                onClick={this.removeSelectedElement}
              >
                Remove Element
              </button>
            </div>
            
            {/* Avatar Properties */}
            {selectedElementData.type === 'avatar' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Avatar Style</label>
                  <div className="grid grid-cols-4 gap-2">
                    {avatars.map(avatar => (
                      <button
                        key={avatar.emoji}
                        className={`py-2 px-3 text-center text-2xl rounded ${
                          selectedElementData.emoji === avatar.emoji ? 
                          'bg-blue-100 border-2 border-blue-500' : 'bg-white border'
                        }`}
                        onClick={() => this.updateElementProperty('emoji', avatar.emoji)}
                      >
                        {avatar.emoji}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Emotion</label>
                  <select 
                    className="w-full p-2 border rounded"
                    value={selectedElementData.emotion || 'neutral'}
                    onChange={(e) => this.updateElementProperty('emotion', e.target.value)}
                  >
                    <option value="neutral">Neutral</option>
                    <option value="happy">Happy</option>
                    <option value="serious">Serious</option>
                    <option value="thoughtful">Thoughtful</option>
                  </select>
                </div>
              </div>
            )}
            
            {/* Text Properties */}
            {selectedElementData.type === 'text' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Text Content</label>
                  <textarea
                    className="w-full p-2 border rounded"
                    rows="2"
                    value={selectedElementData.content || ''}
                    onChange={(e) => this.updateElementProperty('content', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Text Style</label>
                  <select 
                    className="w-full p-2 border rounded"
                    value={selectedElementData.style || 'normal'}
                    onChange={(e) => this.updateElementProperty('style', e.target.value)}
                  >
                    <option value="normal">Normal</option>
                    <option value="heading">Heading</option>
                    <option value="bullet">Bullet Point</option>
                    <option value="quote">Quote</option>
                    <option value="definition">Definition</option>
                  </select>
                </div>
              </div>
            )}
            
            {/* Image Properties */}
            {selectedElementData.type === 'image' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Image Description</label>
                  <textarea
                    className="w-full p-2 border rounded"
                    rows="2"
                    value={selectedElementData.description || ''}
                    onChange={(e) => this.updateElementProperty('description', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Image Style</label>
                  <select 
                    className="w-full p-2 border rounded"
                    value={selectedElementData.style || 'photo'}
                    onChange={(e) => this.updateElementProperty('style', e.target.value)}
                  >
                    <option value="photo">Photo</option>
                    <option value="illustration">Illustration</option>
                    <option value="diagram">Diagram</option>
                  </select>
                </div>
              </div>
            )}
            
            {/* Shape Properties */}
            {selectedElementData.type === 'shape' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Shape Type</label>
                  <select 
                    className="w-full p-2 border rounded"
                    value={selectedElementData.shape_type || 'rectangle'}
                    onChange={(e) => this.updateElementProperty('shape_type', e.target.value)}
                  >
                    <option value="rectangle">Rectangle</option>
                    <option value="circle">Circle</option>
                    <option value="arrow">Arrow</option>
                    <option value="line">Line</option>
                    <option value="star">Star</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Purpose</label>
                  <select 
                    className="w-full p-2 border rounded"
                    value={selectedElementData.purpose || 'highlight'}
                    onChange={(e) => this.updateElementProperty('purpose', e.target.value)}
                  >
                    <option value="highlight">Highlight</option>
                    <option value="connect">Connect</option>
                    <option value="separate">Separate</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        )}
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Scene Text</label>
          <textarea
            className="w-full p-2 border rounded"
            rows="3"
            value={scene.narration || ''}
            onChange={this.handleNarrationChange}
            placeholder="Enter scene narration text..."
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Duration: {duration}s</label>
          <input
            type="range"
            className="w-full"
            min="1"
            max="10"
            step="0.1"
            value={duration}
            onChange={this.handleDurationChange}
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Scene Type</label>
          <div className="grid grid-cols-2 gap-2">
            {sceneTypes.map(type => (
              <button
                key={type.id}
                className={`py-3 px-4 text-center rounded ${scene.scene_type === type.id ? 'bg-purple-500 text-white' : 'bg-gray-100'}`}
                onClick={() => this.handleSceneTypeChange(type.id)}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Animation</label>
          <div className="grid grid-cols-2 gap-2">
            {animations.map(animation => (
              <button
                key={animation.id}
                className={`py-3 px-4 text-center rounded ${selectedAnimation === animation.id ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
                onClick={() => this.handleAnimationSelect(animation.id)}
              >
                {animation.label}
              </button>
            ))}
          </div>
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Key Phrase (shown in video)</label>
          <input
            type="text"
            className="w-full p-2 border rounded"
            value={keyPhrase}
            onChange={this.handleKeyPhraseChange}
            placeholder="Enter key phrase..."
          />
        </div>
        
        <div className="flex justify-end">
          <button
            className="px-4 py-2 bg-gray-300 rounded mr-2"
            onClick={this.props.onCancel}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 bg-blue-500 text-white rounded"
            onClick={this.saveScene}
          >
            Save Scene
          </button>
        </div>
        
        {/* CSS for dropdown menu */}
        <style jsx>{`
          .dropdown:hover .dropdown-menu {
            display: block;
          }
        `}</style>
      </div>
    );
  }
}

// Scene Editor Modal Component
class SceneEditorModal extends React.Component {
  render() {
    const { isOpen, onClose, scene, onSave } = this.props;
    
    if (!isOpen) return null;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-screen overflow-y-auto">
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Edit Scene</h2>
              <button 
                className="text-gray-500 hover:text-gray-700"
                onClick={onClose}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            
            <SceneEditor 
              scene={scene}
              onSave={(updatedScene) => {
                onSave(updatedScene);
                onClose();
              }}
              onCancel={onClose}
            />
          </div>
        </div>
      </div>
    );
  }
}

// Helper function to mount the Scene Editor Modal
function openSceneEditor(scene, onSave) {
  const modalContainer = document.createElement('div');
  modalContainer.id = 'scene-editor-modal-container';
  document.body.appendChild(modalContainer);
  
  function closeModal() {
    ReactDOM.unmountComponentAtNode(modalContainer);
    document.body.removeChild(modalContainer);
  }
  
  ReactDOM.render(
    React.createElement(SceneEditorModal, {
      isOpen: true,
      onClose: closeModal,
      scene: scene,
      onSave: (updatedScene) => {
        onSave(updatedScene);
        closeModal();
      }
    }),
    modalContainer
  );
}
