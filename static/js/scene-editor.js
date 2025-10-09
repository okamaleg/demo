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
    // Update scene if props changed (sync with course player)
    if (prevProps.scene !== this.props.scene && this.props.scene) {
      this.setState({
        scene: this.props.scene,
        duration: this.props.scene.duration || 3.0,
        keyPhrase: this.getKeyPhrase(this.props.scene.narration)
      }, () => {
        this.drawPreview();
        this.mountSmartContentEnhancer();
      });
    }
    
    // Sync with course player if available
    if (this.props.coursePlayer && this.props.sectionIndex !== undefined && this.props.sceneIndex !== undefined) {
      const currentScene = this.props.coursePlayer.getCurrentScene();
      if (currentScene && currentScene !== this.state.scene) {
        this.setState({
          scene: currentScene,
          duration: currentScene.duration || 3.0,
          keyPhrase: this.getKeyPhrase(currentScene.narration)
        }, () => {
          this.drawPreview();
          this.mountSmartContentEnhancer();
        });
      }
    }

    if (prevState.previewMode !== this.state.previewMode && this.state.previewMode) {
      this.startPreviewAnimation();
    } else if (prevState.previewMode !== this.state.previewMode && !this.state.previewMode) {
      if (this.animationRef) {
        cancelAnimationFrame(this.animationRef);
      }
    }

    // Mount smart content enhancer when narration changes
    if (prevState.scene?.narration !== this.state.scene?.narration) {
      // Add a small delay to ensure DOM is updated
      setTimeout(() => {
        this.mountSmartContentEnhancer();
      }, 100);
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

  calculateSmartDuration() {
    const narration = this.state.scene?.narration || '';
    if (!narration.trim()) return 3; // Default 3 seconds for empty content
    
    // Calculate based on word count and reading speed
    const words = narration.trim().split(/\s+/).length;
    const characters = narration.length;
    
    // Base calculation: ~140 words per minute = ~0.43 seconds per word
    let baseDuration = Math.max(3, Math.round(words * 0.43));
    
    // Adjust for content complexity
    const visualElements = this.state.scene?.visual_elements?.length || 0;
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

  mountSmartContentEnhancer = () => {
    console.log('Attempting to mount smart content enhancer...');
    console.log('mountSmartContentEnhancer function available:', typeof mountSmartContentEnhancer === 'function');
    console.log('Scene narration:', this.state.scene?.narration);
    
    // Mount the smart content enhancer if the function is available
    if (typeof mountSmartContentEnhancer === 'function' && this.state.scene?.narration) {
      const container = document.getElementById('smart-content-enhancer-container');
      console.log('Container found:', !!container);
      
      if (container) {
        // Clear any existing content
        container.innerHTML = '';
        
        console.log('Mounting smart content enhancer...');
        mountSmartContentEnhancer('smart-content-enhancer-container', {
          text: this.state.scene.narration,
          contentType: 'narration',
          autoAnalyze: true,
          onTextChange: (newText) => {
            console.log('Text changed to:', newText);
            this.setState(prevState => ({
              scene: {
                ...prevState.scene,
                narration: newText
              }
            }));
          },
          onAnalysisComplete: (analysis) => {
            console.log('Content analysis completed:', analysis);
          }
        });
      }
    }
  }

  // Canvas mouse event handlers
  handleCanvasMouseDown = (e) => {
    if (this.state.previewMode) return;
    
    const rect = this.canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Check if clicking on an existing element
    const clickedElementIndex = this.getElementIndexAtPosition(x, y);
    if (clickedElementIndex !== -1) {
      const clickedElement = this.state.scene.visual_elements[clickedElementIndex];
      
      // Start dragging
      this.setState({ 
        draggingElement: clickedElementIndex,
        selectedElement: clickedElementIndex,
        showElementPanel: true,
        dragStartX: x,
        dragStartY: y
      });
      return;
    }
    
    // Add new element at click position
    this.addVisualElement(this.state.newElementType, x, y);
  }

  getElementAtPosition = (x, y) => {
    if (!this.state.scene.visual_elements) return null;
    
    // Iterate through elements in reverse order (top elements first)
    for (let i = this.state.scene.visual_elements.length - 1; i >= 0; i--) {
      const element = this.state.scene.visual_elements[i];
      
      // Check if click is within element bounds
      const elementX = element.x || 400;
      const elementY = element.y || 225;
      
      const hitSize = this.getElementHitSize(element);
      const halfWidth = hitSize.width / 2;
      const halfHeight = hitSize.height / 2;
      
      if (x >= elementX - halfWidth && x <= elementX + halfWidth &&
          y >= elementY - halfHeight && y <= elementY + halfHeight) {
        return element;
      }
    }
    
    return null;
  }

  getElementIndexAtPosition = (x, y) => {
    if (!this.state.scene.visual_elements) return -1;
    
    // Iterate through elements in reverse order (top elements first)
    for (let i = this.state.scene.visual_elements.length - 1; i >= 0; i--) {
      const element = this.state.scene.visual_elements[i];
      
      // Check if click is within element bounds
      const elementX = element.x || 400;
      const elementY = element.y || 225;
      
      const hitSize = this.getElementHitSize(element);
      const halfWidth = hitSize.width / 2;
      const halfHeight = hitSize.height / 2;
      
      if (x >= elementX - halfWidth && x <= elementX + halfWidth &&
          y >= elementY - halfHeight && y <= elementY + halfHeight) {
        return i;
      }
    }
    
    return -1;
  }

  getElementHitSize = (element) => {
    // Define hit box sizes for different element types
    switch (element.type) {
      case 'avatar':
        return { width: 80, height: 80 };
      case 'image':
        if (element.is_video_snapshot) {
          return { width: element.width || 600, height: element.height || 400 };
        }
        return { width: 200, height: 150 };
      case 'text':
        const textWidth = element.content ? element.content.length * 10 : 100;
        return { width: Math.max(textWidth, 100), height: 50 };
      case 'shape':
        return { width: element.width || 100, height: element.height || 100 };
      default:
        return { width: 100, height: 100 };
    }
  }

  handleCanvasDoubleClick = (e) => {
    if (this.state.previewMode) return;
    
    const rect = this.canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Add new element at double-click position
    this.addVisualElement(this.state.newElementType, x, y);
  }

  handleCanvasMouseMove = (e) => {
    if (!this.state.draggingElement) return;
    
    const rect = this.canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Update the position of the dragged element
    const elementPositions = { ...this.state.elementPositions };
    elementPositions[this.state.draggingElement] = { x, y };
    
    this.setState({ elementPositions }, () => {
      this.drawPreview();
    });
  }

  handleCanvasMouseUp = (e) => {
    if (this.state.draggingElement !== null) {
      // Save the final position to the element
      const elementPositions = { ...this.state.elementPositions };
      const finalPosition = elementPositions[this.state.draggingElement];
      
      if (finalPosition) {
        // Update the element's stored position
        const updatedElements = [...this.state.scene.visual_elements];
        updatedElements[this.state.draggingElement] = {
          ...updatedElements[this.state.draggingElement],
          x: finalPosition.x,
          y: finalPosition.y
        };
        
        this.setState({
          scene: { ...this.state.scene, visual_elements: updatedElements },
          draggingElement: null
        });
      } else {
        this.setState({ draggingElement: null });
      }
    }
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
    const { scene, keyPhrase } = this.state;
    const smartDuration = this.calculateSmartDuration();
    const updatedScene = {
      ...scene,
      duration: smartDuration,
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

  removeElement = (elementIndex) => {
    if (elementIndex === null || elementIndex === undefined) return;
    
    const updatedElements = [...this.state.scene.visual_elements];
    updatedElements.splice(elementIndex, 1);
    
    this.setState({
      scene: {
        ...this.state.scene,
        visual_elements: updatedElements
      },
      selectedElement: null,
      showElementPanel: false
    }, () => {
      this.drawPreview();
    });
  };

  addVisualElement = (type, x, y) => {
    const newElement = {
      type: type,
      x: x,
      y: y,
      id: Date.now() // Simple ID generation
    };

    // Set default properties based on type
    switch (type) {
      case 'avatar':
        newElement.emotion = 'serious';
        newElement.hairColor = '#8B4513';
        newElement.shirtColor = '#4A90E2';
        break;
      case 'text':
        newElement.content = 'New text element';
        newElement.style = 'normal';
        break;
      case 'shape':
        newElement.shape_type = 'rectangle';
        break;
      case 'image':
        newElement.description = 'New image';
        newElement.style = 'photo';
        break;
      case 'video_snapshot':
        newElement.type = 'image';
        newElement.is_video_snapshot = true;
        newElement.width = 600;
        newElement.height = 400;
        newElement.description = 'Video Snapshot';
        newElement.image_data = null;
        break;
    }

    const updatedElements = [...this.state.scene.visual_elements, newElement];
    this.setState({
      scene: {
        ...this.state.scene,
        visual_elements: updatedElements
      }
    }, () => {
      this.drawPreview();
    });
  };

  addVideoSnapshot = () => {
    // Create a placeholder video snapshot
    const newSnapshot = {
      type: 'image',
      x: 400,
      y: 225,
      is_video_snapshot: true,
      width: 600,
      height: 400,
      description: 'Video Snapshot',
      image_data: null, // Will be populated when actual video is processed
      id: Date.now()
    };

    const updatedElements = [...this.state.scene.visual_elements, newSnapshot];
    this.setState({
      scene: {
        ...this.state.scene,
        visual_elements: updatedElements
      }
    }, () => {
      this.drawPreview();
    });
  };
  
  drawPreview() {
    const canvas = this.canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = 800;
    const height = 450;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Draw gradient background (same as course player)
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#3b82f6');
    gradient.addColorStop(1, '#2563eb');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // Draw visual elements using unified system
    if (this.state.scene.visual_elements) {
      this.state.scene.visual_elements.forEach((element, index) => {
        // Check if this element has a custom position from dragging
        const customPos = this.state.elementPositions[index];
        const isSelected = index === this.state.selectedElement;
        const isDragging = index === this.state.draggingElement;
        
        if (customPos) {
          // Draw with custom position
          this.drawElementAt(ctx, customPos.x, customPos.y, element, isSelected, isDragging);
        } else if (element.customX !== undefined && element.customY !== undefined) {
          // Use stored custom coordinates
          this.drawElementAt(ctx, element.customX, element.customY, element, isSelected, isDragging);
        } else {
          // Use standard positioning
          this.drawElement(ctx, width, height, element, isSelected, isDragging);
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

  drawElement(ctx, width, height, element, isSelected = false, isDragging = false) {
    // Use actual coordinates if available, otherwise use position string
    if (element.x !== undefined && element.y !== undefined) {
      this.drawElementAt(ctx, element.x, element.y, element, isSelected, isDragging);
    } else {
      const position = this.getPositionCoordinates(element.position || 'center', width, height);
      this.drawElementAt(ctx, position.x, position.y, element, isSelected, isDragging);
    }
  }
  
  drawElementAt(ctx, x, y, element, isSelected = false, isDragging = false) {
    // Draw selection indicator if element is selected
    if (isSelected) {
      ctx.save();
      ctx.strokeStyle = '#00BFFF'; // Bright blue for selection
      ctx.lineWidth = 3;
      
      const hitSize = this.getElementHitSize(element);
      ctx.strokeRect(x - hitSize.width/2 - 5, y - hitSize.height/2 - 5, hitSize.width + 10, hitSize.height + 10);
      
      // Add resize handles for video snapshots
      if (element.is_video_snapshot) {
        this.drawResizeHandles(ctx, x - hitSize.width/2 - 5, y - hitSize.height/2 - 5, hitSize.width + 10, hitSize.height + 10);
      }
      
      ctx.restore();
    }
    
    // Draw dragging indicator
    if (isDragging) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 191, 255, 0.3)';
      const hitSize = this.getElementHitSize(element);
      ctx.fillRect(x - hitSize.width/2 - 10, y - hitSize.height/2 - 10, hitSize.width + 20, hitSize.height + 20);
      ctx.restore();
    }
    
    switch (element.type) {
      case 'avatar':
        this.drawAvatarAt(ctx, x, y, element, isSelected, isDragging);
        break;
      case 'text':
        this.drawTextAt(ctx, x, y, element, isSelected, isDragging);
        break;
      case 'image':
        this.drawImageAt(ctx, x, y, element, isSelected, isDragging);
        break;
      case 'shape':
        this.drawShapeAt(ctx, x, y, element, isSelected, isDragging);
        break;
    }
  }

  // ----- Drawing helpers for absolute positions -----
  drawAvatarAt(ctx, x, y, element, isSelected = false, isDragging = false) {
    const avatarSize = 120;
    
    // Draw avatar background circle
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.arc(x, y, avatarSize / 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw selection indicator
    if (isSelected) {
      ctx.strokeStyle = '#00BFFF';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, avatarSize / 2 + 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    // Draw dragging indicator
    if (isDragging) {
      ctx.fillStyle = 'rgba(0, 191, 255, 0.3)';
      ctx.beginPath();
      ctx.arc(x, y, avatarSize / 2 + 10, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Draw human avatar (static version for editor)
    this.drawHumanAvatar(ctx, x, y, avatarSize, element, false);
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
    
    // Mouth with emotion (static for editor)
    this.drawMouth(ctx, x, y + 8, scale, false, element.emotion);
    
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

  drawTextAt(ctx, x, y, element, isSelected = false, isDragging = false) {
    const content = element.content || 'Text content';
    const maxWidth = 300;
    
    // Draw selection indicator
    if (isSelected) {
      ctx.strokeStyle = '#00BFFF';
      ctx.lineWidth = 3;
      ctx.strokeRect(x - maxWidth/2 - 5, y - 25, maxWidth + 10, 50);
    }
    
    // Draw dragging indicator
    if (isDragging) {
      ctx.fillStyle = 'rgba(0, 191, 255, 0.3)';
      ctx.fillRect(x - maxWidth/2 - 10, y - 30, maxWidth + 20, 60);
    }
    
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

  drawImageAt(ctx, x, y, element, isSelected = false, isDragging = false) {
    const imgWidth = element.width || 200;
    const imgHeight = element.height || 150;
    
    // Draw selection indicator
    if (isSelected) {
      ctx.strokeStyle = '#00BFFF';
      ctx.lineWidth = 3;
      ctx.strokeRect(x - imgWidth/2 - 5, y - imgHeight/2 - 5, imgWidth + 10, imgHeight + 10);
    }
    
    // Draw dragging indicator
    if (isDragging) {
      ctx.fillStyle = 'rgba(0, 191, 255, 0.3)';
      ctx.fillRect(x - imgWidth/2 - 10, y - imgHeight/2 - 10, imgWidth + 20, imgHeight + 20);
    }
    
    // Check if this is a video snapshot (main visual element)
    if (element.is_video_snapshot) {
      // Draw the actual video snapshot (large, main element)
      if (element.image_data) {
        // Use the element's actual dimensions for video snapshots
        const actualWidth = element.width || imgWidth;
        const actualHeight = element.height || imgHeight;
        
        // Try to draw the image if it's already loaded
        const img = new Image();
        img.onload = () => {
          // Clear the placeholder and draw the actual image
          ctx.clearRect(x - actualWidth/2, y - actualHeight/2, actualWidth, actualHeight);
          ctx.drawImage(img, x - actualWidth/2, y - actualHeight/2, actualWidth, actualHeight);
          
          // Add a subtle border to indicate it's a video snapshot
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 2;
          ctx.strokeRect(x - actualWidth/2, y - actualHeight/2, actualWidth, actualHeight);
          
          // Add video icon overlay (smaller, less intrusive)
          ctx.fillStyle = 'rgba(16, 185, 129, 0.7)';
          ctx.fillRect(x + actualWidth/2 - 20, y - actualHeight/2, 20, 20);
          ctx.fillStyle = '#ffffff';
          ctx.font = '12px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🎬', x + actualWidth/2 - 10, y - actualHeight/2 + 10);
        };
        img.onerror = () => {
          console.error('Failed to load image:', element.image_data);
        };
        img.src = element.image_data;
        
        // Draw placeholder while image loads
        ctx.fillStyle = 'rgba(16, 185, 129, 0.3)';
        ctx.fillRect(x - actualWidth/2, y - actualHeight/2, actualWidth, actualHeight);
        ctx.fillStyle = '#000000';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🎬', x, y);
        ctx.font = '14px Arial';
        ctx.fillText('Loading...', x, y + 20);
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
      // Regular image element
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
  }

  drawResizeHandles(ctx, x, y, width, height) {
    const handleSize = 8;
    const handles = [
      { x: x, y: y }, // top-left
      { x: x + width/2, y: y }, // top-center
      { x: x + width, y: y }, // top-right
      { x: x + width, y: y + height/2 }, // right-center
      { x: x + width, y: y + height }, // bottom-right
      { x: x + width/2, y: y + height }, // bottom-center
      { x: x, y: y + height }, // bottom-left
      { x: x, y: y + height/2 } // left-center
    ];
    
    ctx.fillStyle = '#00BFFF';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    
    handles.forEach(handle => {
      ctx.fillRect(handle.x - handleSize/2, handle.y - handleSize/2, handleSize, handleSize);
      ctx.strokeRect(handle.x - handleSize/2, handle.y - handleSize/2, handleSize, handleSize);
    });
  }

  drawShapeAt(ctx, x, y, element, isSelected = false, isDragging = false) {
    // Draw selection indicator
    if (isSelected) {
      ctx.strokeStyle = '#00BFFF';
      ctx.lineWidth = 3;
      ctx.strokeRect(x - 50, y - 30, 100, 60);
    }
    
    // Draw dragging indicator
    if (isDragging) {
      ctx.fillStyle = 'rgba(0, 191, 255, 0.3)';
      ctx.fillRect(x - 55, y - 35, 110, 70);
    }
    
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
    const duration = this.calculateSmartDuration() * 1000; // convert to ms
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
      { id: 'shape', label: 'Shape' },
      { id: 'video_snapshot', label: 'Video Snapshot' }
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
              <strong>Tip:</strong> Video snapshots are the main visual element. Add avatars, text, and shapes around them to enhance learning.
            </span>
          </div>
          <div className="relative bg-gray-900 rounded-lg overflow-hidden">
            <canvas 
              ref={this.canvasRef}
              width={800}
              height={450}
              className="w-full cursor-crosshair"
              onMouseDown={this.handleCanvasMouseDown}
              onMouseMove={this.handleCanvasMouseMove}
              onMouseUp={this.handleCanvasMouseUp}
              onDoubleClick={this.handleCanvasDoubleClick}
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
                  <label className="block text-sm font-medium mb-1">Avatar Emotion</label>
                  <select 
                    className="w-full p-2 border rounded"
                    value={selectedElementData.emotion || 'serious'}
                    onChange={(e) => this.updateElementProperty('emotion', e.target.value)}
                  >
                    <option value="happy">Happy</option>
                    <option value="serious">Serious</option>
                    <option value="thoughtful">Thoughtful</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Hair Color</label>
                  <select 
                    className="w-full p-2 border rounded"
                    value={selectedElementData.hairColor || '#8B4513'}
                    onChange={(e) => this.updateElementProperty('hairColor', e.target.value)}
                  >
                    <option value="#8B4513">Brown</option>
                    <option value="#654321">Dark Brown</option>
                    <option value="#2F4F4F">Dark Slate Gray</option>
                    <option value="#DAA520">Golden</option>
                    <option value="#000000">Black</option>
                    <option value="#FFB6C1">Blonde</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Shirt Color</label>
                  <select 
                    className="w-full p-2 border rounded"
                    value={selectedElementData.shirtColor || '#4A90E2'}
                    onChange={(e) => this.updateElementProperty('shirtColor', e.target.value)}
                  >
                    <option value="#4A90E2">Blue</option>
                    <option value="#2E8B57">Sea Green</option>
                    <option value="#8B0000">Dark Red</option>
                    <option value="#FF6347">Tomato</option>
                    <option value="#9370DB">Purple</option>
                    <option value="#32CD32">Lime Green</option>
                  </select>
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
                {selectedElementData.is_video_snapshot && (
                  <div className="space-y-3 border-t pt-3">
                    <h4 className="font-medium text-blue-600">Video Snapshot Settings</h4>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Width: {selectedElementData.width || 600}px
                      </label>
                      <input
                        type="range"
                        min="200"
                        max="800"
                        className="w-full"
                        value={selectedElementData.width || 600}
                        onChange={(e) => this.updateElementProperty('width', parseInt(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Height: {selectedElementData.height || 400}px
                      </label>
                      <input
                        type="range"
                        min="150"
                        max="600"
                        className="w-full"
                        value={selectedElementData.height || 400}
                        onChange={(e) => this.updateElementProperty('height', parseInt(e.target.value))}
                      />
                    </div>
                    <div>
                      <button
                        onClick={() => this.removeElement(this.state.selectedElement)}
                        className="w-full px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                      >
                        Remove Video Snapshot
                      </button>
                    </div>
                  </div>
                )}
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
          
          {/* Smart Content Enhancement */}
          {scene.narration && scene.narration.trim() && (
            <div className="mt-4">
              <div className="mb-2">
                <button
                  onClick={this.mountSmartContentEnhancer}
                  className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                >
                  🧠 Analyze Content
                </button>
              </div>
              <div id="smart-content-enhancer-container"></div>
            </div>
          )}
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">
            Duration: {this.calculateSmartDuration()}s (auto-calculated)
          </label>
          <div className="text-sm text-gray-600">
            Based on content length and complexity
          </div>
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
              coursePlayer={this.props.coursePlayer}
              sectionIndex={this.props.sectionIndex}
              sceneIndex={this.props.sceneIndex}
            />
          </div>
        </div>
      </div>
    );
  }
}

// Helper function to mount the Scene Editor Modal
function openSceneEditor(scene, onSave, options = {}) {
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
      },
      coursePlayer: options.coursePlayer,
      sectionIndex: options.sectionIndex,
      sceneIndex: options.sceneIndex
    }),
    modalContainer
  );
}
