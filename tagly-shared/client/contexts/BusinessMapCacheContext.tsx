import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { BusinessPublicPreview } from "@tagly/models/v2/customerApp";

type Coords = { latitude: number; longitude: number };
type Bounds = { ne: Coords; sw: Coords };

/**
 * In-memory cache backing `BusinessMap`: the locals/coords seen so far, which
 * map tiles + bounds have been fetched, and a `cacheVersion` the map watches to
 * clear local state and refetch (e.g. after a new audience snapshot changes
 * reward estimates). Refs (not state) so high-frequency map updates don't
 * re-render consumers.
 */
export type BusinessMapCache = {
  localsByUidRef: React.RefObject<Map<string, BusinessPublicPreview>>;
  coordsByUidRef: React.RefObject<Map<string, Coords>>;
  fetchedTilesRef: React.RefObject<Set<string>>;
  fetchedBoundsRef: React.RefObject<Bounds | null>;
  coverageBoundsRef: React.RefObject<Bounds | null>;
  /** Incremented each time resetCache is called. BusinessMap watches this to clear local state and refetch. */
  cacheVersion: number;
  resetCache: () => void;
};

const Ctx = createContext<BusinessMapCache | null>(null);

export const BusinessMapCacheProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const localsByUidRef = useRef(new Map<string, BusinessPublicPreview>());
  const coordsByUidRef = useRef(new Map<string, Coords>());
  const fetchedTilesRef = useRef(new Set<string>());
  const fetchedBoundsRef = useRef<Bounds | null>(null);
  const coverageBoundsRef = useRef<Bounds | null>(null);
  const [cacheVersion, setCacheVersion] = useState(0);

  // Clears all cached data and bumps cacheVersion so BusinessMap can react.
  const resetCache = useCallback(() => {
    localsByUidRef.current.clear();
    coordsByUidRef.current.clear();
    fetchedTilesRef.current.clear();
    fetchedBoundsRef.current = null;
    coverageBoundsRef.current = null;
    setCacheVersion((v) => v + 1);
  }, []);

  return (
    <Ctx.Provider
      value={{
        localsByUidRef,
        coordsByUidRef,
        fetchedTilesRef,
        fetchedBoundsRef,
        coverageBoundsRef,
        cacheVersion,
        resetCache,
      }}
    >
      {children}
    </Ctx.Provider>
  );
};

export const useBusinessMapCache = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useBusinessMapCache must be inside provider");
  return v;
};
