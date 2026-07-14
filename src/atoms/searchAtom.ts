import { atom } from "jotai";
import type { SearchResult } from "@/types";

export const searchQueryAtom = atom<string>("");
export const searchResultsAtom = atom<SearchResult[]>([]);
export const isSearchingAtom = atom<boolean>(false);
export const isSearchPanelOpenAtom = atom<boolean>(false);
