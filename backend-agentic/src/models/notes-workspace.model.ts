import mongoose, { Document, Model, Schema } from 'mongoose';

export interface ITopicGraphNode {
  section_id: string;
  title: string;
  estimated_words?: number;
  key_concepts: string[];
}

export interface ITopicGraphEdge {
  from: string;
  to: string;
  relationship: string;
}

export interface ITopicGraph {
  nodes: ITopicGraphNode[];
  edges: ITopicGraphEdge[];
}

export interface ICoverageChecklistItem {
  requirement_id: string;
  syllabus_text: string;
  mapped_section_id: string;
  status: 'pending' | 'drafted' | 'verified';
}

export interface IGeneratedSection {
  title: string;
  content_markdown: string;
  word_count?: number;
  status: 'pending' | 'generating' | 'completed' | 'repairing';
  updated_at?: Date;
}

export interface ITermDefined {
  term: string;
  definition: string;
  introduced_in_section: string;
}

export interface ICrossReferenceAnchor {
  anchor_id: string;
  section_id: string;
  label: string;
}

export interface IStyleDecisions {
  depth?: 'concise' | 'detailed' | 'qa';
  tone?: string;
  math_format?: string;
  include_code_examples?: boolean;
  primary_language?: string;
  [key: string]: unknown;
}

export interface ISourceUsed {
  type: 'vector_chunk' | 'web_search';
  source_id?: string;
  query?: string;
}

export interface IVerificationIssue {
  check: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  repair_instruction?: string;
}

export interface IVerificationResult {
  section_id: string;
  iteration: number;
  passed: boolean;
  checks: Record<string, string>;
  issues: IVerificationIssue[];
}

export interface IOutstandingGap {
  requirement_id?: string;
  section_id?: string;
  description: string;
  severity?: string;
}

export interface INotesWorkspace extends Document {
  mission_id: string;
  user_id?: string;
  syllabus_topics: string[];
  topic_graph: ITopicGraph;
  coverage_checklist: ICoverageChecklistItem[];
  generated_sections: Record<string, IGeneratedSection>;
  final_markdown?: string;
  terms_defined: ITermDefined[];
  cross_reference_anchors: ICrossReferenceAnchor[];
  style_decisions: IStyleDecisions;
  sources_used: Record<string, ISourceUsed[]>;
  verification_results: IVerificationResult[];
  outstanding_gaps: IOutstandingGap[];
  createdAt: Date;
  updatedAt: Date;
}

const NotesWorkspaceSchema = new Schema<INotesWorkspace>(
  {
    mission_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    user_id: {
      type: String,
    },
    syllabus_topics: {
      type: [String],
      default: [],
    },
    topic_graph: {
      nodes: [
        {
          section_id: String,
          title: String,
          estimated_words: Number,
          key_concepts: [String],
        },
      ],
      edges: [
        {
          from: String,
          to: String,
          relationship: String,
        },
      ],
    },
    coverage_checklist: [
      {
        requirement_id: String,
        syllabus_text: String,
        mapped_section_id: String,
        status: {
          type: String,
          enum: ['pending', 'drafted', 'verified'],
          default: 'pending',
        },
      },
    ],
    generated_sections: {
      type: Schema.Types.Mixed,
      default: {},
    },
    final_markdown: {
      type: String,
      default: '',
    },
    terms_defined: [
      {
        term: String,
        definition: String,
        introduced_in_section: String,
      },
    ],
    cross_reference_anchors: [
      {
        anchor_id: String,
        section_id: String,
        label: String,
      },
    ],
    style_decisions: {
      type: Schema.Types.Mixed,
      default: {},
    },
    sources_used: {
      type: Schema.Types.Mixed,
      default: {},
    },
    verification_results: [
      {
        section_id: String,
        iteration: Number,
        passed: Boolean,
        checks: Schema.Types.Mixed,
        issues: [
          {
            check: String,
            severity: { type: String, enum: ['low', 'medium', 'high'] },
            description: String,
            repair_instruction: String,
          },
        ],
      },
    ],
    outstanding_gaps: [
      {
        requirement_id: String,
        section_id: String,
        description: String,
        severity: String,
      },
    ],
  },
  {
    timestamps: true,
  }
);

export const NotesWorkspaceModel: Model<INotesWorkspace> =
  mongoose.models.NotesWorkspace ||
  mongoose.model<INotesWorkspace>('NotesWorkspace', NotesWorkspaceSchema);
