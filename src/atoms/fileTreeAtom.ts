import { atom } from "jotai";
import type { FileNode } from "@/types";

export const fileTreeAtom = atom<FileNode | null>(null);
