"""
Simple script to test if all dependencies are installed correctly.
Run this before starting the main application.
"""

import sys
import importlib.util

def check_module(module_name):
    """Check if a module can be imported."""
    try:
        importlib.import_module(module_name)
        return True
    except ImportError:
        return False

def main():
    """Check all required dependencies."""
    modules = [
        "flask",
        "flask_cors",
        "openai",
        "dotenv",
        "moviepy",
        "werkzeug"
    ]
    
    all_ok = True
    
    print(f"Python version: {sys.version}")
    print("Checking dependencies:")
    
    for module in modules:
        if check_module(module):
            print(f"✅ {module} is installed")
        else:
            print(f"❌ {module} is NOT installed")
            all_ok = False
    
    if all_ok:
        print("\nAll dependencies are installed! You can run the application with:")
        print("python app.py")
    else:
        print("\nSome dependencies are missing. Please install them with:")
        print("pip install -r requirements.txt")

if __name__ == "__main__":
    main()
