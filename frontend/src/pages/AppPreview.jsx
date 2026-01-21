import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import {
  ArrowLeft,
  ExternalLink,
  FolderOpen,
  FileCode,
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  X,
  Maximize2,
  Minimize2,
  RefreshCw,
  Eye,
  Code,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const FileIcon = ({ name, isFolder }) => {
  if (isFolder) return <Folder className="w-4 h-4 text-amber-400" />;
  
  const ext = name.split('.').pop().toLowerCase();
  const iconColors = {
    js: 'text-yellow-400',
    jsx: 'text-cyan-400',
    ts: 'text-blue-400',
    tsx: 'text-blue-400',
    html: 'text-orange-400',
    css: 'text-purple-400',
    scss: 'text-pink-400',
    json: 'text-green-400',
    md: 'text-gray-400',
    svg: 'text-emerald-400',
  };
  
  return <File className={`w-4 h-4 ${iconColors[ext] || 'text-gray-400'}`} />;
};

const FileTreeItem = ({ node, level = 0, onSelect, selectedPath }) => {
  const [expanded, setExpanded] = useState(level < 2);
  const isFolder = node.type === 'directory';
  const isSelected = selectedPath === node.path;

  const handleClick = () => {
    if (isFolder) {
      setExpanded(!expanded);
    } else {
      onSelect(node);
    }
  };

  return (
    <div>
      <div
        className={`file-tree-item flex items-center gap-2 ${isSelected ? 'active' : ''}`}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={handleClick}
        data-testid={`file-${node.path}`}
      >
        {isFolder && (
          expanded ? 
            <ChevronDown className="w-3 h-3 text-muted-foreground flex-shrink-0" /> : 
            <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
        )}
        {!isFolder && <span className="w-3" />}
        <FileIcon name={node.name} isFolder={isFolder} />
        <span className="text-sm truncate">{node.name}</span>
      </div>
      {isFolder && expanded && node.children?.map((child, idx) => (
        <FileTreeItem
          key={`${child.path}-${idx}`}
          node={child}
          level={level + 1}
          onSelect={onSelect}
          selectedPath={selectedPath}
        />
      ))}
    </div>
  );
};

export default function AppPreview() {
  const { appId } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState(null);
  const [fileTree, setFileTree] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState("preview");
  const [iframeKey, setIframeKey] = useState(0);

  const fetchApp = useCallback(async () => {
    try {
      const [appRes, filesRes] = await Promise.all([
        axios.get(`${API}/apps/${appId}`),
        axios.get(`${API}/apps/${appId}/files`)
      ]);
      setApp(appRes.data);
      setFileTree(filesRes.data.tree);
    } catch (error) {
      toast.error("Failed to load app");
      navigate('/');
    } finally {
      setLoading(false);
    }
  }, [appId, navigate]);

  useEffect(() => {
    fetchApp();
  }, [fetchApp]);

  const handleFileSelect = async (file) => {
    setSelectedFile(file);
    setActiveTab("code");
    
    try {
      const response = await axios.get(`${API}/apps/${appId}/content/${file.path}`);
      setFileContent(response.data);
    } catch (error) {
      setFileContent({ type: 'error', message: 'Failed to load file' });
    }
  };

  const refreshPreview = () => {
    setIframeKey(prev => prev + 1);
  };

  const openInNewTab = () => {
    window.open(`${API}/apps/${appId}/serve/${app.entry_file}`, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!app) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">App not found</p>
      </div>
    );
  }

  const iframeUrl = `${API}/apps/${appId}/serve/${app.entry_file}`;

  return (
    <div className={`min-h-screen bg-background flex flex-col ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Header */}
      <header className="preview-header sticky top-0 z-40 flex-shrink-0">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            {!isFullscreen && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/')}
                data-testid="back-button"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                <FileCode className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h1 className="font-semibold text-sm">{app.name}</h1>
                <p className="text-xs text-muted-foreground font-mono">{app.framework || 'Unknown'}</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={refreshPreview}
              title="Refresh"
              data-testid="refresh-preview"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={openInNewTab}
              title="Open in new tab"
              data-testid="open-new-tab"
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              data-testid="toggle-fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
            
            {/* File Explorer Sheet */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" data-testid="open-files">
                  <FolderOpen className="w-4 h-4 mr-2" />
                  Files
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 p-0">
                <SheetHeader className="p-4 border-b border-border">
                  <SheetTitle className="text-left flex items-center gap-2">
                    <FolderOpen className="w-4 h-4" />
                    Project Files
                  </SheetTitle>
                </SheetHeader>
                <ScrollArea className="h-[calc(100vh-80px)]">
                  <div className="py-2">
                    {fileTree?.children?.map((node, idx) => (
                      <FileTreeItem
                        key={`${node.path}-${idx}`}
                        node={node}
                        onSelect={handleFileSelect}
                        selectedPath={selectedFile?.path}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <div className="px-4 border-b border-border">
            <TabsList className="h-10 bg-transparent">
              <TabsTrigger value="preview" className="data-[state=active]:bg-card" data-testid="tab-preview">
                <Eye className="w-4 h-4 mr-2" />
                Preview
              </TabsTrigger>
              <TabsTrigger value="code" className="data-[state=active]:bg-card" data-testid="tab-code">
                <Code className="w-4 h-4 mr-2" />
                Code
                {selectedFile && (
                  <span className="ml-2 text-xs text-muted-foreground font-mono">
                    {selectedFile.name}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="preview" className="flex-1 m-0 p-4">
            <div className="iframe-container h-full" data-testid="preview-container">
              <iframe
                key={iframeKey}
                src={iframeUrl}
                title={app.name}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                data-testid="app-iframe"
              />
            </div>
          </TabsContent>

          <TabsContent value="code" className="flex-1 m-0 overflow-hidden">
            {selectedFile ? (
              <div className="h-full flex flex-col">
                <div className="px-4 py-2 border-b border-border flex items-center justify-between bg-card">
                  <div className="flex items-center gap-2">
                    <FileIcon name={selectedFile.name} isFolder={false} />
                    <span className="text-sm font-mono">{selectedFile.path}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setSelectedFile(null);
                      setFileContent(null);
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <ScrollArea className="flex-1">
                  <div className="code-viewer">
                    {fileContent?.type === 'text' ? (
                      <pre className="text-sm text-foreground whitespace-pre-wrap break-all">
                        {fileContent.content}
                      </pre>
                    ) : fileContent?.type === 'binary' ? (
                      <div className="p-8 text-center text-muted-foreground">
                        <FileCode className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Binary file - cannot display</p>
                      </div>
                    ) : fileContent?.type === 'error' ? (
                      <div className="p-8 text-center text-destructive">
                        <p>{fileContent.message}</p>
                      </div>
                    ) : (
                      <div className="p-8 text-center text-muted-foreground">
                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Select a file from the Files panel to view its content</p>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
