export interface FileNode {
  name: string;
  path: string;
  is_directory: boolean;
  children?: FileNode[];
}

export interface OpenFile {
  path: string;
  name: string;
  content: string;
  savedContent: string;
}

export interface HeadingItem {
  text: string;
  level: number;
  paragraph: number;
}

export interface SearchResult {
  file_path: string;
  file_name: string;
  line: number;
  content: string;
  match_start: number;
  match_end: number;
}
