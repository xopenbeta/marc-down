import { atom } from "jotai";
import type { HeadingItem } from "@/types";

export const outlineAtom = atom<HeadingItem[]>([]);
