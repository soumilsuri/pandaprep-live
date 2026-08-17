import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IAgentCheckpoint extends Document {
  thread_id: string;
  checkpoint_id: string;
  parent_checkpoint_id?: string | null;
  node?: string;
  state: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const AgentCheckpointSchema = new Schema<IAgentCheckpoint>(
  {
    thread_id: {
      type: String,
      required: true,
      index: true,
    },
    checkpoint_id: {
      type: String,
      required: true,
      index: true,
    },
    parent_checkpoint_id: {
      type: String,
      default: null,
    },
    node: {
      type: String,
    },
    state: {
      type: Schema.Types.Mixed,
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

AgentCheckpointSchema.index({ thread_id: 1, checkpoint_id: 1 }, { unique: true });
AgentCheckpointSchema.index({ thread_id: 1, createdAt: -1 });
AgentCheckpointSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 7 });

export const AgentCheckpointModel: Model<IAgentCheckpoint> =
  mongoose.models.AgentCheckpoint ||
  mongoose.model<IAgentCheckpoint>('AgentCheckpoint', AgentCheckpointSchema);
