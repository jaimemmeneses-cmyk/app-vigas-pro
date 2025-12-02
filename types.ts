export type SupportType = 'pinned' | 'roller' | 'fixed';
export type LoadType = 'point' | 'udl' | 'moment';

export type LengthUnit = 'm' | 'cm' | 'mm' | 'ft' | 'in';
export type ForceUnit = 'kN' | 'N' | 'kgf' | 'lb' | 'kip';

export interface Support {
  id: string;
  x: number;
  type: SupportType;
}

export interface Load {
  id: string;
  type: LoadType;
  magnitude?: number; // For point and moment
  w?: number;        // For UDL
  x?: number;        // For point and moment
  x_start?: number;  // For UDL
  x_end?: number;    // For UDL
}

export interface SectionProperties {
  I: number;
  E: number;
}

export interface BeamConfig {
  length: number;
  section: SectionProperties;
}

export interface ReactionResult {
  supportId: string;
  x: number;
  Ry: number;
  M: number;
}

export interface EquilibriumCheck {
  sumFy: number;
  sumM: number;
}

export interface KeyPointResult {
  x: number;
  shearLeft: number;
  shearRight: number;
  momentLeft: number;
  momentRight: number;
  description: string;
}

export interface AnalysisResults {
  reactions: ReactionResult[];
  checks?: EquilibriumCheck;
  x_points: number[];
  shear_points: number[];
  moment_points: number[];
  keyPoints: KeyPointResult[];
  log: string[];
  peaks?: {
    maxMoment: { x: number; value: number };
  };
}

export interface AppState {
  meta: { 
    units: { 
      length: LengthUnit; 
      force: ForceUnit; 
    } 
  };
  beam: BeamConfig;
  supports: Support[];
  loads: Load[];
  results: AnalysisResults;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  isError?: boolean;
}