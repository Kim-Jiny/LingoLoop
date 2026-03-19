import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sentence } from './sentence.entity.js';
import { DailyAssignment } from './daily-assignment.entity.js';
import { Language } from './language.entity.js';

@Injectable()
export class SentencesService {
  constructor(
    @InjectRepository(Sentence)
    private sentencesRepo: Repository<Sentence>,
    @InjectRepository(DailyAssignment)
    private dailyAssignmentRepo: Repository<DailyAssignment>,
    @InjectRepository(Language)
    private languageRepo: Repository<Language>,
  ) {}

  async getToday(userId: string, languageCode = 'en') {
    const today = new Date().toISOString().split('T')[0];

    // Check if already assigned
    let assignment = await this.dailyAssignmentRepo.findOne({
      where: { userId, assignedDate: today },
      relations: ['sentence', 'sentence.words', 'sentence.grammarNotes'],
    });

    if (assignment) {
      return this.formatSentenceResponse(assignment);
    }

    // Find language
    const language = await this.languageRepo.findOne({
      where: { code: languageCode },
    });
    if (!language) {
      throw new NotFoundException(`Language ${languageCode} not found`);
    }

    // Get already assigned sentence IDs for this user
    const previousAssignments = await this.dailyAssignmentRepo.find({
      where: { userId },
      select: ['sentenceId'],
    });
    const assignedIds = previousAssignments.map((a) => a.sentenceId);

    // Pick next unassigned sentence
    const queryBuilder = this.sentencesRepo
      .createQueryBuilder('sentence')
      .where('sentence.languageId = :languageId', {
        languageId: language.id,
      })
      .andWhere('sentence.isActive = :isActive', { isActive: true });

    if (assignedIds.length > 0) {
      queryBuilder.andWhere('sentence.id NOT IN (:...assignedIds)', {
        assignedIds,
      });
    }

    const sentence = await queryBuilder
      .orderBy('sentence.orderIndex', 'ASC')
      .getOne();

    if (!sentence) {
      // Cycle back: pick the oldest assigned sentence
      const oldestAssignment = await this.dailyAssignmentRepo.findOne({
        where: { userId },
        order: { assignedDate: 'ASC' },
      });
      if (!oldestAssignment) {
        throw new NotFoundException('No sentences available');
      }
      return this.assignAndReturn(userId, oldestAssignment.sentenceId, today);
    }

    return this.assignAndReturn(userId, sentence.id, today);
  }

  private async assignAndReturn(
    userId: string,
    sentenceId: number,
    date: string,
  ) {
    const assignment = await this.dailyAssignmentRepo.save({
      userId,
      sentenceId,
      assignedDate: date,
    });

    const fullAssignment = await this.dailyAssignmentRepo.findOne({
      where: { id: assignment.id },
      relations: ['sentence', 'sentence.words', 'sentence.grammarNotes'],
    });

    return this.formatSentenceResponse(fullAssignment!);
  }

  private formatSentenceResponse(assignment: DailyAssignment) {
    const sentence = assignment.sentence;
    return {
      assignmentId: assignment.id,
      assignedDate: assignment.assignedDate,
      isCompleted: assignment.isCompleted,
      sentence: {
        id: sentence.id,
        text: sentence.text,
        translation: sentence.translation,
        pronunciation: sentence.pronunciation,
        situation: sentence.situation,
        difficulty: sentence.difficulty,
        category: sentence.category,
        words: sentence.words
          ?.sort((a, b) => a.orderIndex - b.orderIndex)
          .map((w) => ({
            word: w.word,
            meaning: w.meaning,
            pronunciation: w.pronunciation,
            partOfSpeech: w.partOfSpeech,
            example: w.example,
          })),
        grammarNotes: sentence.grammarNotes
          ?.sort((a, b) => a.orderIndex - b.orderIndex)
          .map((g) => ({
            title: g.title,
            explanation: g.explanation,
            example: g.example,
          })),
      },
    };
  }

  async findAll(languageCode?: string) {
    const query = this.sentencesRepo
      .createQueryBuilder('sentence')
      .leftJoinAndSelect('sentence.language', 'language')
      .leftJoinAndSelect('sentence.words', 'words')
      .leftJoinAndSelect('sentence.grammarNotes', 'grammarNotes')
      .where('sentence.isActive = :isActive', { isActive: true })
      .orderBy('sentence.orderIndex', 'ASC');

    if (languageCode) {
      query.andWhere('language.code = :code', { code: languageCode });
    }

    return query.getMany();
  }

  async findOne(id: number) {
    const sentence = await this.sentencesRepo.findOne({
      where: { id },
      relations: ['words', 'grammarNotes', 'language'],
    });
    if (!sentence) {
      throw new NotFoundException(`Sentence #${id} not found`);
    }
    return sentence;
  }

  async getHistory(userId: string, page = 1, limit = 20) {
    const [assignments, total] = await this.dailyAssignmentRepo.findAndCount({
      where: { userId },
      relations: ['sentence'],
      order: { assignedDate: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items: assignments.map((a) => ({
        assignedDate: a.assignedDate,
        isCompleted: a.isCompleted,
        sentence: {
          id: a.sentence.id,
          text: a.sentence.text,
          translation: a.sentence.translation,
          difficulty: a.sentence.difficulty,
        },
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }
}
