import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { notesGenerationGraph } from '../src/graph/graph.js';
import { env } from '../src/config/env.js';
import {
  calculateCompletenessScore,
  calculateFaithfulnessScore,
  calculateCoherenceScore,
  calculateLatexSyntaxScore,
  calculateSingleScore,
  calculateAggregateScore,
  SingleEvalResult,
} from './scoring.js';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface SyllabusItem {
  id: string;
  category: string;
  subject_name: string;
  syllabus: string;
  education_level: 'beginner' | 'intermediate' | 'advanced';
  note_type: 'concise' | 'detailed' | 'qa';
  key_topics_expected: string[];
}

const TARGET_MIN_SCORE = 95.0; // 95% pass threshold

export async function runGoldenEvaluations(options?: { sampleSize?: number; category?: string }) {
  // 1. Ensure Database Connection (Atlas or MongoMemoryServer fallback)
  let mongod: MongoMemoryServer | null = null;
  if (mongoose.connection.readyState === 0) {
    try {
      if (env.MONGODB_URI && !env.MONGODB_URI.includes('127.0.0.1')) {
        await connectDB();
      } else {
        mongod = await MongoMemoryServer.create();
        await mongoose.connect(mongod.getUri('pandaprep-evals'));
      }
    } catch {
      mongod = await MongoMemoryServer.create();
      await mongoose.connect(mongod.getUri('pandaprep-evals'));
    }
  }

  const datasetPath = path.join(__dirname, 'golden-syllabi.json');
  const rawData = fs.readFileSync(datasetPath, 'utf-8');
  let syllabi: SyllabusItem[] = JSON.parse(rawData);

  if (options?.category) {
    syllabi = syllabi.filter((s) => s.category.toLowerCase().includes(options.category!.toLowerCase()));
  }

  if (options?.sampleSize && options.sampleSize > 0) {
    syllabi = syllabi.slice(0, options.sampleSize);
  }

  console.log(`\n🧪 Starting Golden Benchmark Evaluation on ${syllabi.length} syllabi...`);
  console.log(`🎯 Quality Threshold: Q_aggregate >= ${TARGET_MIN_SCORE}%\n`);

  const results: SingleEvalResult[] = [];
  const singleScores: number[] = [];

  try {
    for (let i = 0; i < syllabi.length; i++) {
      const item = syllabi[i];
      const missionId = `eval-${item.id}-${uuidv4().slice(0, 8)}`;

      const startTime = Date.now();
      process.stdout.write(`[${i + 1}/${syllabi.length}] Evaluating "${item.subject_name}" (${item.category})... `);

      try {
        const graphInput = {
          missionId,
          subjectName: item.subject_name,
          syllabus: item.syllabus,
          noteType: item.note_type,
          educationLevel: item.education_level,
          includeExamples: 'yes' as const,
          userInstructions: 'Provide rigorous academic definitions and valid LaTeX equations.',
          format: 'markdown' as const,
        };

        const finalState = await notesGenerationGraph.invoke(graphInput);
        const durationMs = Date.now() - startTime;

        const completeness = calculateCompletenessScore(finalState, item.key_topics_expected);
        const faithfulness = calculateFaithfulnessScore(finalState);
        const coherence = calculateCoherenceScore(finalState);
        const syntax = calculateLatexSyntaxScore(finalState.finalMarkdown || '');

        const compositeScore = calculateSingleScore({
          completeness,
          faithfulness,
          coherence,
          syntax,
        });

        singleScores.push(compositeScore);

        const passed = compositeScore >= 90.0;
        results.push({
          id: item.id,
          category: item.category,
          subjectName: item.subject_name,
          scores: { completeness, faithfulness, coherence, syntax },
          compositeScore,
          passed,
        });

        console.log(`Score: ${compositeScore}% (${durationMs}ms) ${passed ? '✅' : '⚠️'}`);
      } catch (error: any) {
        console.log(`❌ FAILED: ${error.message}`);
        singleScores.push(0);
        results.push({
          id: item.id,
          category: item.category,
          subjectName: item.subject_name,
          scores: { completeness: 0, faithfulness: 0, coherence: 0, syntax: 0 },
          compositeScore: 0,
          passed: false,
          notes: [error.message],
        });
      }
    }
  } finally {
    if (mongod) {
      await mongoose.disconnect();
      await mongod.stop();
    }
  }

  const aggregateScore = calculateAggregateScore(singleScores);

  console.log('\n========================================================================================');
  console.log('                            PANDAPREP GOLDEN EVALUATION REPORT                         ');
  console.log('========================================================================================');
  console.log('| ID       | Category          | S_comp | S_faith | S_cohere | S_syntax | Score (Q_i) |');
  console.log('|----------|-------------------|--------|---------|----------|----------|-------------|');

  for (const r of results) {
    const sComp = (r.scores.completeness * 100).toFixed(0).padStart(5) + '%';
    const sFaith = (r.scores.faithfulness * 100).toFixed(0).padStart(6) + '%';
    const sCohere = (r.scores.coherence * 100).toFixed(0).padStart(7) + '%';
    const sSyntax = (r.scores.syntax * 100).toFixed(0).padStart(7) + '%';
    const qScore = (r.compositeScore.toFixed(1) + '%').padStart(10);
    const cat = r.category.padEnd(17).slice(0, 17);
    const id = r.id.padEnd(8);

    console.log(`| ${id} | ${cat} | ${sComp} | ${sFaith} | ${sCohere} | ${sSyntax} | ${qScore} |`);
  }

  console.log('========================================================================================');
  console.log(`📊 Aggregate Quality Score (Q_aggregate): ${aggregateScore}%`);
  console.log(`🎯 Target Minimum: ${TARGET_MIN_SCORE}%`);

  const passedThreshold = aggregateScore >= TARGET_MIN_SCORE;
  if (passedThreshold) {
    console.log(`\n🎉 EVALUATION PASSED: Q_aggregate (${aggregateScore}%) meets or exceeds ${TARGET_MIN_SCORE}%!\n`);
    return { success: true, aggregateScore, results };
  } else {
    console.error(`\n❌ EVALUATION REGRESSION: Q_aggregate (${aggregateScore}%) is below target ${TARGET_MIN_SCORE}%!\n`);
    return { success: false, aggregateScore, results };
  }
}

// Direct CLI invocation
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const sampleArg = process.argv.find((a) => a.startsWith('--sample='));
  const sampleSize = sampleArg ? parseInt(sampleArg.split('=')[1], 10) : undefined;

  const catArg = process.argv.find((a) => a.startsWith('--category='));
  const category = catArg ? catArg.split('=')[1] : undefined;

  runGoldenEvaluations({ sampleSize, category })
    .then((outcome) => {
      process.exit(outcome.success ? 0 : 1);
    })
    .catch((err) => {
      console.error('Fatal error during evaluation run:', err);
      process.exit(1);
    });
}
