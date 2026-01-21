from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException
from fastapi.responses import Response, FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import zipfile
import shutil
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import mimetypes

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Upload directory
UPLOAD_DIR = ROOT_DIR / 'uploads'
UPLOAD_DIR.mkdir(exist_ok=True)

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Models
class AppMetadata(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    entry_file: str = "index.html"
    framework: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    file_count: int = 0
    size_bytes: int = 0

class AppResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    entry_file: str
    framework: Optional[str]
    created_at: str
    file_count: int
    size_bytes: int

class FileNode(BaseModel):
    name: str
    path: str
    type: str  # 'file' or 'directory'
    children: Optional[List['FileNode']] = None
    size: Optional[int] = None

FileNode.model_rebuild()

def detect_framework(app_dir: Path) -> Optional[str]:
    """Detect the frontend framework used in the project."""
    package_json = app_dir / 'package.json'
    if package_json.exists():
        import json
        try:
            with open(package_json) as f:
                pkg = json.load(f)
                deps = {**pkg.get('dependencies', {}), **pkg.get('devDependencies', {})}
                if 'react' in deps:
                    return 'React'
                elif 'vue' in deps:
                    return 'Vue'
                elif 'svelte' in deps:
                    return 'Svelte'
                elif '@angular/core' in deps:
                    return 'Angular'
        except:
            pass
    
    # Check for vanilla HTML
    if (app_dir / 'index.html').exists():
        return 'HTML/CSS/JS'
    
    return None

def find_entry_file(app_dir: Path) -> str:
    """Find the main entry file for the app."""
    # Check common build output directories
    build_dirs = ['dist', 'build', 'public', 'out', '.']
    
    for build_dir in build_dirs:
        check_dir = app_dir / build_dir if build_dir != '.' else app_dir
        if check_dir.exists():
            index = check_dir / 'index.html'
            if index.exists():
                if build_dir != '.':
                    return f"{build_dir}/index.html"
                return "index.html"
    
    return "index.html"

def get_dir_size(path: Path) -> int:
    """Calculate total size of directory."""
    total = 0
    for file in path.rglob('*'):
        if file.is_file():
            total += file.stat().st_size
    return total

def count_files(path: Path) -> int:
    """Count total files in directory."""
    return sum(1 for f in path.rglob('*') if f.is_file())

def build_file_tree(path: Path, base_path: Path) -> FileNode:
    """Build a file tree structure for the given path."""
    rel_path = str(path.relative_to(base_path))
    
    if path.is_file():
        return FileNode(
            name=path.name,
            path=rel_path,
            type='file',
            size=path.stat().st_size
        )
    
    children = []
    try:
        for child in sorted(path.iterdir(), key=lambda x: (x.is_file(), x.name.lower())):
            # Skip hidden files and node_modules
            if child.name.startswith('.') or child.name == 'node_modules':
                continue
            children.append(build_file_tree(child, base_path))
    except PermissionError:
        pass
    
    return FileNode(
        name=path.name,
        path=rel_path,
        type='directory',
        children=children
    )

@api_router.get("/")
async def root():
    return {"message": "Frontend Project Previewer API"}

@api_router.post("/apps/upload", response_model=AppResponse)
async def upload_app(file: UploadFile = File(...), name: Optional[str] = None):
    """Upload a ZIP file containing a frontend project."""
    if not file.filename.endswith('.zip'):
        raise HTTPException(status_code=400, detail="Only ZIP files are allowed")
    
    app_id = str(uuid.uuid4())
    app_dir = UPLOAD_DIR / app_id
    
    try:
        # Save uploaded ZIP
        zip_path = UPLOAD_DIR / f"{app_id}.zip"
        with open(zip_path, 'wb') as f:
            content = await file.read()
            f.write(content)
        
        # Extract ZIP
        app_dir.mkdir(exist_ok=True)
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(app_dir)
        
        # Remove ZIP file after extraction
        zip_path.unlink()
        
        # Handle nested folder (common in ZIP files)
        subdirs = list(app_dir.iterdir())
        if len(subdirs) == 1 and subdirs[0].is_dir():
            nested_dir = subdirs[0]
            # Move contents up one level
            for item in nested_dir.iterdir():
                shutil.move(str(item), str(app_dir / item.name))
            nested_dir.rmdir()
        
        # Detect framework and entry file
        framework = detect_framework(app_dir)
        entry_file = find_entry_file(app_dir)
        
        # Get app name
        app_name = name or file.filename.replace('.zip', '')
        
        # Create metadata
        metadata = AppMetadata(
            id=app_id,
            name=app_name,
            framework=framework,
            entry_file=entry_file,
            file_count=count_files(app_dir),
            size_bytes=get_dir_size(app_dir)
        )
        
        # Save to database
        doc = metadata.model_dump()
        await db.apps.insert_one(doc)
        
        return AppResponse(**doc)
        
    except zipfile.BadZipFile:
        if app_dir.exists():
            shutil.rmtree(app_dir)
        raise HTTPException(status_code=400, detail="Invalid ZIP file")
    except Exception as e:
        if app_dir.exists():
            shutil.rmtree(app_dir)
        logging.error(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/apps", response_model=List[AppResponse])
async def list_apps():
    """List all uploaded apps."""
    apps = await db.apps.find({}, {"_id": 0}).to_list(1000)
    return apps

@api_router.get("/apps/{app_id}", response_model=AppResponse)
async def get_app(app_id: str):
    """Get a single app's metadata."""
    app = await db.apps.find_one({"id": app_id}, {"_id": 0})
    if not app:
        raise HTTPException(status_code=404, detail="App not found")
    return app

@api_router.delete("/apps/{app_id}")
async def delete_app(app_id: str):
    """Delete an uploaded app."""
    app = await db.apps.find_one({"id": app_id})
    if not app:
        raise HTTPException(status_code=404, detail="App not found")
    
    # Delete files
    app_dir = UPLOAD_DIR / app_id
    if app_dir.exists():
        shutil.rmtree(app_dir)
    
    # Delete from database
    await db.apps.delete_one({"id": app_id})
    
    return {"message": "App deleted successfully"}

@api_router.get("/apps/{app_id}/files")
async def get_app_files(app_id: str):
    """Get the file structure of an uploaded app."""
    app = await db.apps.find_one({"id": app_id}, {"_id": 0})
    if not app:
        raise HTTPException(status_code=404, detail="App not found")
    
    app_dir = UPLOAD_DIR / app_id
    if not app_dir.exists():
        raise HTTPException(status_code=404, detail="App files not found")
    
    tree = build_file_tree(app_dir, app_dir)
    return {"tree": tree.model_dump()}

@api_router.get("/apps/{app_id}/serve/{file_path:path}")
async def serve_app_file(app_id: str, file_path: str):
    """Serve a file from an uploaded app."""
    app = await db.apps.find_one({"id": app_id}, {"_id": 0})
    if not app:
        raise HTTPException(status_code=404, detail="App not found")
    
    app_dir = UPLOAD_DIR / app_id
    file_full_path = app_dir / file_path
    
    # Security check - prevent directory traversal
    try:
        file_full_path.resolve().relative_to(app_dir.resolve())
    except ValueError:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if not file_full_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    if file_full_path.is_dir():
        # Try to serve index.html from directory
        index_file = file_full_path / 'index.html'
        if index_file.exists():
            file_full_path = index_file
        else:
            raise HTTPException(status_code=404, detail="Directory listing not allowed")
    
    # Determine content type
    content_type, _ = mimetypes.guess_type(str(file_full_path))
    if content_type is None:
        content_type = 'application/octet-stream'
    
    # Special handling for HTML files to fix relative paths
    if content_type == 'text/html':
        with open(file_full_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        
        # Inject base tag to handle relative paths
        base_url = f"/api/apps/{app_id}/serve/"
        if '<head>' in content:
            content = content.replace('<head>', f'<head><base href="{base_url}">')
        elif '<HEAD>' in content:
            content = content.replace('<HEAD>', f'<HEAD><base href="{base_url}">')
        else:
            content = f'<base href="{base_url}">' + content
        
        return Response(content=content, media_type=content_type)
    
    return FileResponse(file_full_path, media_type=content_type)

@api_router.get("/apps/{app_id}/content/{file_path:path}")
async def get_file_content(app_id: str, file_path: str):
    """Get the raw content of a file for viewing."""
    app = await db.apps.find_one({"id": app_id}, {"_id": 0})
    if not app:
        raise HTTPException(status_code=404, detail="App not found")
    
    app_dir = UPLOAD_DIR / app_id
    file_full_path = app_dir / file_path
    
    # Security check
    try:
        file_full_path.resolve().relative_to(app_dir.resolve())
    except ValueError:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if not file_full_path.exists() or file_full_path.is_dir():
        raise HTTPException(status_code=404, detail="File not found")
    
    # Check if it's a text file
    content_type, _ = mimetypes.guess_type(str(file_full_path))
    text_types = ['text/', 'application/json', 'application/javascript', 'application/xml']
    
    is_text = content_type and any(t in content_type for t in text_types)
    
    if is_text:
        try:
            with open(file_full_path, 'r', encoding='utf-8') as f:
                content = f.read()
            return {"content": content, "type": "text"}
        except:
            pass
    
    return {"content": None, "type": "binary", "message": "Binary file - cannot display"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
