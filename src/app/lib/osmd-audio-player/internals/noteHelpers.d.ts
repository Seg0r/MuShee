import { Note } from 'opensheetmusicdisplay/build/dist/src';
import { ArticulationStyle } from '../players/NotePlaybackOptions';
export declare function getNoteArticulationStyle(note: Note): ArticulationStyle;
export declare function getNoteDuration(note: Note, wholeNoteLength: number): number;
export declare function getNoteVolume(note: Note): number;
