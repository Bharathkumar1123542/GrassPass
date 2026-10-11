import { z } from 'zod';
import type { ChallengeDefinition } from '../config/types';

const SlotDefinitionSchema = z.object({
  id: z.string(),
  label: z.string(),
  subjectQuestion: z.string().endsWith('?'),
});

const ChallengeDefinitionSchema = z.object({
  id: z.string(),
  title: z.string(),
  instructions: z.string(),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  slots: z.array(SlotDefinitionSchema).min(1).max(5),
});

export const challengeCatalog: ChallengeDefinition[] = [
  {
    id: 'leaf-trail',
    title: 'Leaf trail',
    instructions: 'Photograph leaves in different environments.',
    difficulty: 1,
    slots: [
      { id: 'leaf-one', label: 'Leaf 1', subjectQuestion: 'Is this photo of a leaf?' },
      { id: 'leaf-two', label: 'Leaf 2', subjectQuestion: 'Is this photo of a leaf?' },
    ],
  },
  {
    id: 'skyline',
    title: 'Skyline',
    instructions: 'Capture a wide outdoors scene.',
    difficulty: 2,
    slots: [
      { id: 'skyline-one', label: 'Frame 1', subjectQuestion: 'Is this photo outdoors?' },
      { id: 'skyline-two', label: 'Frame 2', subjectQuestion: 'Is this photo outdoors?' },
      { id: 'skyline-three', label: 'Frame 3', subjectQuestion: 'Is this photo outdoors?' },
    ],
  },
  {
    id: 'tree-study',
    title: 'Tree study',
    instructions: 'Photograph distinct tree textures and foliage.',
    difficulty: 2,
    slots: [
      { id: 'tree-one', label: 'Tree 1', subjectQuestion: 'Is this photo of a tree or foliage?' },
      { id: 'tree-two', label: 'Tree 2', subjectQuestion: 'Is this photo of a tree or foliage?' },
      { id: 'tree-three', label: 'Tree 3', subjectQuestion: 'Is this photo of a tree or foliage?' },
    ],
  },
  {
    id: 'marking',
    title: 'Street markings',
    instructions: 'Photograph different outdoor signs or markings.',
    difficulty: 2,
    slots: [
      { id: 'mark-one', label: 'Mark 1', subjectQuestion: 'Is this photo of a sidewalk or sign?' },
      { id: 'mark-two', label: 'Mark 2', subjectQuestion: 'Is this photo of a sidewalk or sign?' },
    ],
  },
  {
    id: 'bloom',
    title: 'Bloom check',
    instructions: 'Capture flowers or blossoms outdoors.',
    difficulty: 2,
    slots: [
      { id: 'bloom-one', label: 'Bloom 1', subjectQuestion: 'Is this photo of a flower or bloom?' },
      { id: 'bloom-two', label: 'Bloom 2', subjectQuestion: 'Is this photo of a flower or bloom?' },
    ],
  },
  {
    id: 'trail',
    title: 'Trail',
    instructions: 'Photograph a trail or path outdoors.',
    difficulty: 1,
    slots: [
      { id: 'trail-one', label: 'Path 1', subjectQuestion: 'Is this photo of a path or trail?' },
      { id: 'trail-two', label: 'Path 2', subjectQuestion: 'Is this photo of a path or trail?' },
    ],
  },
  {
    id: 'sunlight',
    title: 'Sunlight study',
    instructions: 'Photograph sunlight falling on outdoor surfaces.',
    difficulty: 3,
    slots: [
      { id: 'sun-one', label: 'Light 1', subjectQuestion: 'Is this photo of sunlight outdoors?' },
      { id: 'sun-two', label: 'Light 2', subjectQuestion: 'Is this photo of sunlight outdoors?' },
      { id: 'sun-three', label: 'Light 3', subjectQuestion: 'Is this photo of sunlight outdoors?' },
    ],
  },
  {
    id: 'urban-nature',
    title: 'Urban nature',
    instructions: 'Photograph nature cues in a city setting.',
    difficulty: 3,
    slots: [
      { id: 'urban-one', label: 'Scene 1', subjectQuestion: 'Is this photo of nature outdoors?' },
      { id: 'urban-two', label: 'Scene 2', subjectQuestion: 'Is this photo of nature outdoors?' },
      { id: 'urban-three', label: 'Scene 3', subjectQuestion: 'Is this photo of nature outdoors?' },
    ],
  },
];

for (const challenge of challengeCatalog) {
  ChallengeDefinitionSchema.parse(challenge);
}

export function getChallengeById(id: string): ChallengeDefinition | undefined {
  return challengeCatalog.find((challenge) => challenge.id === id);
}
