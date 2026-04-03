import {
    Requirement,
    RequirementCategory,
    RequirementStatus,
    ScoreboardDisplay,
} from '@/database/requirement';
import { User } from '@/database/user';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FullTrainingPlanSection, Section } from './FullTrainingPlanSection';

vi.mock('./FullTrainingPlanItem', () => ({
    FullTrainingPlanItem: ({
        requirement,
        isArchived,
    }: {
        requirement: Requirement;
        isArchived: boolean;
    }) => <div data-testid={`item-${requirement.id}`}>{isArchived ? 'archived' : ''}</div>,
}));

vi.mock('@/scoreboard/ScoreboardProgress', () => ({
    __esModule: true,
    default: () => <div data-testid='scoreboard-progress' />,
    ProgressText: ({ value, max, min }: { value: number; max: number; min: number }) => (
        <span data-testid='progress-text'>{`${value}/${max}/${min}`}</span>
    ),
}));

vi.mock('../ScheduleClassicalGame', () => ({
    ScheduleClassicalGame: () => null,
}));

vi.mock('./FullTrainingPlanGraduationItem', () => ({
    FullTrainingPlanGraduationItem: () => null,
}));

vi.mock('../CustomTaskEditor', () => ({
    default: () => null,
}));

function makeRequirement(id: string): Requirement {
    return {
        id,
        status: RequirementStatus.Active,
        category: RequirementCategory.Games,
        name: `Task ${id}`,
        description: '',
        freeDescription: '',
        counts: { '1400-1500': 1000 },
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

const mockFreeUser: User = {
    username: '',
    displayName: '',
    discordUsername: '',
    dojoCohort: '1400-1500',
    bio: '',
    ratingSystem: 'CHESSCOM' as User['ratingSystem'],
    ratings: {},
    progress: {},
    disableBookingNotifications: false,
    disableCancellationNotifications: false,
    isAdmin: false,
    isCalendarAdmin: false,
    isTournamentAdmin: false,
    isBetaTester: false,
    isCoach: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    numberOfGraduations: 0,
    previousCohort: '',
    lastGraduatedAt: '',
    enableLightMode: false,
    enableZenMode: false,
    timezoneOverride: 'DEFAULT',
    timeFormat: '24' as User['timeFormat'],
    hasCreatedProfile: true,
    followerCount: 0,
    followingCount: 0,
    referralSource: '',
    totalDojoScore: 0,
    subscriptionStatus: 'NOT_SUBSCRIBED' as User['subscriptionStatus'],
    subscriptionTier: 'FREE' as User['subscriptionTier'],
    exams: {},
    weekStart: 0,
    gameSchedule: [],
};

function renderSection(showArchived: boolean) {
    const uncompletedTask1 = makeRequirement('task-1');
    const uncompletedTask2 = makeRequirement('task-2');
    const uncompletedTask3 = makeRequirement('task-3');
    const completedTask1 = makeRequirement('ctask-1');
    const completedTask2 = makeRequirement('ctask-2');
    const completedTask3 = makeRequirement('ctask-3');
    const completedTask4 = makeRequirement('ctask-4');

    const section: Section = {
        category: RequirementCategory.Games,
        uncompletedTasks: [uncompletedTask1, uncompletedTask2, uncompletedTask3],
        completedTasks: [completedTask1, completedTask2, completedTask3, completedTask4],
        archivedTaskIds: new Set(['task-2', 'ctask-1', 'ctask-4']),
        color: '#000',
        progressBar: 0,
    };

    render(
        <FullTrainingPlanSection
            section={section}
            expanded
            toggleExpand={() => undefined}
            user={mockFreeUser}
            isCurrentUser
            cohort='1400-1500'
            togglePin={() => undefined}
            pinnedTasks={[]}
            showCompleted={true}
            setShowCompleted={() => undefined}
            showArchived={showArchived}
        />,
    );
}

describe('FullTrainingPlanSection', () => {
    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    describe('Archived Tasks Handling', () => {
        it('passes archived status to items correctly', () => {
            renderSection(true);

            const archivedItem = screen.getByTestId('item-task-2');
            const unarchivedItem = screen.getByTestId('item-task-1');

            expect(archivedItem).toHaveTextContent('archived');
            expect(unarchivedItem).not.toHaveTextContent('archived');
        });

        describe('Uncompleted Task Section', () => {
            it('hides archived tasks when showArchived is false', () => {
                renderSection(false);

                expect(screen.queryByTestId('item-task-2')).not.toBeInTheDocument();
            });

            it('shows archived tasks when showArchived is true', () => {
                renderSection(true);

                expect(screen.queryByTestId('item-task-2')).toBeInTheDocument();
            });

            it('renders archived tasks after unarchived tasks when showArchived is true', () => {
                renderSection(true);

                const renderedItems = screen.getAllByTestId(/item-task-/);
                expect(renderedItems.map((el) => el.getAttribute('data-testid'))).toEqual([
                    'item-task-1',
                    'item-task-3',
                    'item-task-2',
                ]);
            });
        });

        describe('Completed Task Section', () => {
            it('hides archived tasks when showArchived is false', () => {
                renderSection(false);

                expect(screen.queryByTestId('item-ctask-1')).not.toBeInTheDocument();
                expect(screen.queryByTestId('item-ctask-4')).not.toBeInTheDocument();
            });

            it('shows archived tasks when showArchived is true', () => {
                renderSection(true);

                expect(screen.queryByTestId('item-ctask-1')).toBeInTheDocument();
                expect(screen.queryByTestId('item-ctask-4')).toBeInTheDocument();
            });

            it('renders archived tasks after unarchived tasks when showArchived is true', () => {
                renderSection(true);

                const renderedItems = screen.getAllByTestId(/item-ctask-/);
                expect(renderedItems.map((el) => el.getAttribute('data-testid'))).toEqual([
                    'item-ctask-2',
                    'item-ctask-3',
                    'item-ctask-1',
                    'item-ctask-4',
                ]);
            });
        });
    });
});
