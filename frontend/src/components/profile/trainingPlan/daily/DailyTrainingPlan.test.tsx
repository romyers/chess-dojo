import {
    Requirement,
    RequirementCategory,
    RequirementStatus,
    ScoreboardDisplay,
} from '@/database/requirement';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TrainingPlanContext } from '../TrainingPlanTab';
import { DailyTrainingPlan } from './DailyTrainingPlan';

vi.mock('usehooks-ts', () => ({
    useLocalStorage: () => [true, vi.fn()],
}));

vi.mock('@/style/ThemeProvider', () => ({
    themeRequirementCategory: () => 'primary',
}));

vi.mock('../full/FullTrainingPlanItem', () => ({
    displayProgress: () => false,
}));

vi.mock('../useTrainingPlan', () => ({
    useTrainingPlanProgress: () => [30, 0, 0, new Set<string>()],
}));

vi.mock('../WorkGoalSettingsEditor', () => ({
    WorkGoalSettingsEditor: () => null,
}));

vi.mock('../ScheduleClassicalGame', () => ({
    ScheduleClassicalGameDaily: () => null,
}));

vi.mock('./GraduationTask', () => ({
    GraduationTask: () => null,
}));

vi.mock('./TaskTimerIconButton', () => ({
    TaskTimerIconButton: () => null,
}));

vi.mock('../TaskDialog', () => ({
    TaskDialog: () => null,
    TaskDialogView: {
        Details: 'DETAILS',
        Progress: 'PROGRESS',
    },
}));

vi.mock('../TaskDescription', () => ({
    TaskDescription: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function makeRequirement(id: string): Requirement {
    return {
        id,
        status: RequirementStatus.Active,
        category: RequirementCategory.Games,
        name: `Task ${id}`,
        description: '',
        freeDescription: '',
        counts: { '1400-1500': 1 },
        startCount: 0,
        numberOfCohorts: 1,
        unitScore: 0,
        totalScore: 0,
        scoreboardDisplay: ScoreboardDisplay.ProgressBar,
        progressBarSuffix: '',
        updatedAt: '2026-01-01T00:00:00Z',
        sortPriority: id,
        expirationDays: -1,
        isFree: true,
        atomic: false,
        expectedMinutes: 0,
    };
}

function makeSuggestions(task: Requirement) {
    const suggestionsByDay = Array.from(
        { length: 7 },
        () => [] as { task: Requirement; goalMinutes: number }[],
    );
    suggestionsByDay[new Date().getDay()] = [{ task, goalMinutes: 30 }];
    return suggestionsByDay;
}

function renderDailyTrainingPlan(archivedTasks: string[]) {
    const task = makeRequirement('task-1');
    const contextValue = {
        suggestionsByDay: makeSuggestions(task),
        isCurrentUser: true,
        timeline: [],
        isLoading: false,
        user: {
            dojoCohort: '1400-1500',
            progress: {},
            archivedTasks,
            weekStart: 0,
            workGoal: undefined,
            workGoalHistory: [],
            customTasks: [],
        },
        skippedTaskIds: [],
        allRequirements: [task],
        pinnedTasks: [],
        togglePin: () => undefined,
        toggleSkip: () => undefined,
    };

    render(
        <TrainingPlanContext value={contextValue as never}>
            <DailyTrainingPlan />
        </TrainingPlanContext>,
    );
}

describe('DailyTrainingPlan', () => {
    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    describe('Archived task display', () => {
        it('shows an Archived chip when the task is archived', () => {
            renderDailyTrainingPlan(['task-1']);

            expect(screen.getByText('Archived')).toBeInTheDocument();
        });

        it('does not show an Archived chip when the task is not archived', () => {
            renderDailyTrainingPlan([]);

            expect(screen.queryByText('Archived')).not.toBeInTheDocument();
        });
    });
});
