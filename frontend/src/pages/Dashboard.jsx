import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { 
  Upload, 
  FolderOpen, 
  Trash2, 
  Play, 
  FileCode, 
  Clock, 
  HardDrive,
  Layers,
  X,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getFrameworkColor = (framework) => {
  const colors = {
    'React': 'text-cyan-400',
    'Vue': 'text-emerald-400',
    'Angular': 'text-red-400',
    'Svelte': 'text-orange-400',
    'HTML/CSS/JS': 'text-amber-400',
  };
  return colors[framework] || 'text-gray-400';
};

const getFrameworkIcon = (framework) => {
  return <FileCode className="w-4 h-4" />;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, app: null });

  const fetchApps = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/apps`);
      setApps(response.data);
    } catch (error) {
      toast.error("Failed to load apps");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApps();
  }, [fetchApps]);

  const handleUpload = async (file) => {
    if (!file) return;
    
    if (!file.name.endsWith('.zip')) {
      toast.error("Please upload a ZIP file");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', file);

    try {
      await axios.post(`${API}/apps/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(progress);
        }
      });
      
      toast.success("App uploaded successfully!");
      fetchApps();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleUpload(e.target.files[0]);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.app) return;
    
    try {
      await axios.delete(`${API}/apps/${deleteDialog.app.id}`);
      toast.success("App deleted");
      fetchApps();
    } catch (error) {
      toast.error("Failed to delete app");
    } finally {
      setDeleteDialog({ open: false, app: null });
    }
  };

  return (
    <div className="min-h-screen bg-background noise">
      {/* Header */}
      <header className="sticky top-0 z-50 glass">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Layers className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">Frontend Previewer</h1>
                <p className="text-sm text-muted-foreground">Upload & preview web apps</p>
              </div>
            </div>
            <div className="text-sm text-muted-foreground font-mono">
              {apps.length} {apps.length === 1 ? 'app' : 'apps'}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 md:px-12 py-8">
        {/* Upload Zone */}
        <div 
          data-testid="upload-zone"
          className={`relative mb-12 rounded-xl border-2 border-dashed transition-all duration-300 ${
            dragActive 
              ? 'border-primary bg-primary/10 glow-primary' 
              : 'border-border upload-zone-idle hover:border-primary/50'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept=".zip"
            onChange={handleFileInput}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={uploading}
            data-testid="file-input"
          />
          
          <div className="flex flex-col items-center justify-center py-16 px-6">
            {uploading ? (
              <>
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
                <p className="text-lg font-medium mb-2">Uploading...</p>
                <div className="w-64 mb-2">
                  <Progress value={uploadProgress} className="h-2" />
                </div>
                <p className="text-sm text-muted-foreground font-mono">{uploadProgress}%</p>
              </>
            ) : (
              <>
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors ${
                  dragActive ? 'bg-primary/30' : 'bg-card'
                }`}>
                  <Upload className={`w-8 h-8 transition-colors ${
                    dragActive ? 'text-primary' : 'text-muted-foreground'
                  }`} />
                </div>
                <p className="text-lg font-medium mb-1">
                  {dragActive ? 'Drop your ZIP file here' : 'Drop your project ZIP here'}
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  or click to browse
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                  <span className="px-2 py-1 rounded bg-card">.zip</span>
                  <span>React, Vue, Angular, or plain HTML/CSS/JS</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Apps Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 rounded-xl skeleton-shimmer" />
            ))}
          </div>
        ) : apps.length === 0 ? (
          <div className="text-center py-20 empty-state-bg rounded-xl">
            <FolderOpen className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No apps yet</h3>
            <p className="text-muted-foreground mb-6">
              Upload your first frontend project to get started
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {apps.map((app) => (
              <Card 
                key={app.id} 
                className="group card-hover bg-card border-border overflow-hidden"
                data-testid={`app-card-${app.id}`}
              >
                <CardContent className="p-0">
                  {/* Card Header */}
                  <div className="p-6 pb-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          {getFrameworkIcon(app.framework)}
                        </div>
                        <div>
                          <h3 className="font-semibold truncate max-w-[180px]" title={app.name}>
                            {app.name}
                          </h3>
                          {app.framework && (
                            <span className={`framework-badge ${getFrameworkColor(app.framework)}`}>
                              {app.framework}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Meta info */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground font-mono">
                      <div className="flex items-center gap-1">
                        <FileCode className="w-3 h-3" />
                        <span>{app.file_count} files</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <HardDrive className="w-3 h-3" />
                        <span>{formatBytes(app.size_bytes)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono mt-2">
                      <Clock className="w-3 h-3" />
                      <span>{formatDate(app.created_at)}</span>
                    </div>
                  </div>
                  
                  {/* Card Actions */}
                  <div className="border-t border-border p-4 flex items-center gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1"
                      onClick={() => navigate(`/app/${app.id}`)}
                      data-testid={`run-app-${app.id}`}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Run App
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteDialog({ open: true, app })}
                      data-testid={`delete-app-${app.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete App</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteDialog.app?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="cancel-delete">
              <X className="w-4 h-4 mr-2" />
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="confirm-delete"
            >
              <Check className="w-4 h-4 mr-2" />
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
