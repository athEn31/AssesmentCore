/**
 * Outcome Mapper
 * Maps question metadata to QTI outcome declarations and scoring
 */

import { OutcomeDeclaration, ResponseDeclaration } from './types';

/**
 * Outcome Configuration from Question Metadata
 */
export interface OutcomeConfig {
  points?: number; // Question points (default: 1)
  difficulty?: 'easy' | 'medium' | 'hard';
  weight?: number; // Question weight multiplier
  penaltyFactor?: number; // Penalty for incorrect (0-1)
  timeLimit?: number; // Time limit in seconds
}

/**
 * Outcome Mapper Class
 */
export class OutcomeMapper {
  /**
   * Build standard outcome declarations
   * Creates SCORE and MAXSCORE outcomes with metadata
   */
  static buildStandardOutcomes(config: OutcomeConfig = {}): OutcomeDeclaration[] {
    const maxScore = config.points || 1;

    return [
      {
        identifier: 'MAXSCORE',
        cardinality: 'single',
        baseType: 'float',
        defaultValue: maxScore.toString(),
      },
      {
        identifier: 'SCORE',
        cardinality: 'single',
        baseType: 'float',
        defaultValue: '0',
      },
    ];
  }

  /**
   * Build extended outcomes with additional metadata
   */
  static buildExtendedOutcomes(config: OutcomeConfig = {}): OutcomeDeclaration[] {
    const outcomes = this.buildStandardOutcomes(config);

    // Add FEEDBACK outcome if needed
    outcomes.push({
      identifier: 'FEEDBACK',
      cardinality: 'single',
      baseType: 'identifier',
      defaultValue: 'none',
    });

    // Add completion status
    outcomes.push({
      identifier: 'completionStatus',
      cardinality: 'single',
      baseType: 'identifier',
      defaultValue: 'not_attempted',
    });

    // Add duration tracking
    if (config.timeLimit) {
      outcomes.push({
        identifier: 'duration',
        cardinality: 'single',
        baseType: 'integer',
        defaultValue: '0',
      });
    }

    return outcomes;
  }

  /**
   * Map response declaration with points
   */
  static mapResponseWithPoints(
    baseDeclaration: ResponseDeclaration,
    points: number
  ): ResponseDeclaration {
    // Add mapping for point-based scoring
    if (points !== 1) {
      return {
        ...baseDeclaration,
        mapping: {
          defaultValue: 0,
          mappingEntries: baseDeclaration.correctResponse
            ? baseDeclaration.correctResponse.values.map(value => ({
                mapKey: value,
                mappedValue: points,
              }))
            : [],
        },
      };
    }

    return baseDeclaration;
  }

  /**
   * Create outcome mapping for partial credit scenarios
   */
  static createPartialCreditMapping(
    correctAnswers: string[],
    fullCredit: number,
    partialCreditRules: Array<{ value: string; creditRatio: number }>
  ): Array<{ mapKey: string; mappedValue: number }> {
    const mappingEntries: Array<{ mapKey: string; mappedValue: number }> = [];

    // Full credit answers
    correctAnswers.forEach(answer => {
      mappingEntries.push({
        mapKey: answer,
        mappedValue: fullCredit,
      });
    });

    // Partial credit answers
    partialCreditRules.forEach(rule => {
      mappingEntries.push({
        mapKey: rule.value,
        mappedValue: fullCredit * rule.creditRatio,
      });
    });

    return mappingEntries;
  }

  /**
   * Calculate difficulty score (for analytics)
   */
  static mapDifficultyToScore(difficulty?: 'easy' | 'medium' | 'hard'): number {
    const difficultyMap = {
      easy: 0.3,
      medium: 0.5,
      hard: 0.8,
    };

    return difficultyMap[difficulty || 'medium'];
  }

  /**
   * Create weighted scoring outcome
   */
  static buildWeightedOutcome(
    basePoints: number,
    weight: number
  ): OutcomeDeclaration {
    const weightedMax = basePoints * weight;

    return {
      identifier: 'MAXSCORE',
      cardinality: 'single',
      baseType: 'float',
      defaultValue: weightedMax.toString(),
    };
  }

  /**
   * Build custom outcome for specific purpose
   */
  static buildCustomOutcome(
    identifier: string,
    baseType: 'identifier' | 'string' | 'integer' | 'float' | 'boolean',
    defaultValue: string | number,
    cardinality: 'single' | 'multiple' | 'ordered' = 'single'
  ): OutcomeDeclaration {
    return {
      identifier,
      cardinality,
      baseType,
      defaultValue: String(defaultValue),
    };
  }
}

/**
 * Helper to get outcomes from question metadata
 */
export function getOutcomesFromMetadata(metadata: {
  points?: number;
  difficulty?: string;
  weight?: number;
  timeLimit?: number;
  trackCompletion?: boolean;
}): OutcomeDeclaration[] {
  const config: OutcomeConfig = {
    points: metadata.points || 1,
    difficulty: metadata.difficulty as any,
    weight: metadata.weight,
    timeLimit: metadata.timeLimit,
  };

  if (metadata.trackCompletion) {
    return OutcomeMapper.buildExtendedOutcomes(config);
  }

  return OutcomeMapper.buildStandardOutcomes(config);
}

/**
 * Validate outcome declarations
 */
export function validateOutcomes(
  outcomes: OutcomeDeclaration[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for required SCORE outcome
  const hasScore = outcomes.some(o => o.identifier === 'SCORE');
  if (!hasScore) {
    errors.push('Missing required SCORE outcome declaration');
  }

  // Check for MAXSCORE
  const hasMaxScore = outcomes.some(o => o.identifier === 'MAXSCORE');
  if (!hasMaxScore) {
    errors.push('Missing MAXSCORE outcome declaration');
  }

  // Check for duplicate identifiers
  const identifiers = outcomes.map(o => o.identifier);
  const duplicates = identifiers.filter(
    (id, index) => identifiers.indexOf(id) !== index
  );
  if (duplicates.length > 0) {
    errors.push(`Duplicate outcome identifiers: ${duplicates.join(', ')}`);
  }

  // Validate data types
  outcomes.forEach(outcome => {
    if (!outcome.identifier || outcome.identifier.trim() === '') {
      errors.push('Outcome identifier cannot be empty');
    }

    if (!outcome.baseType) {
      errors.push(`Outcome ${outcome.identifier} missing baseType`);
    }

    if (!outcome.cardinality) {
      errors.push(`Outcome ${outcome.identifier} missing cardinality`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}
