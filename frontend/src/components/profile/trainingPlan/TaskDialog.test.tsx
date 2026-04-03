import {
    Requirement,
    RequirementCategory,
    RequirementStatus,
    ScoreboardDisplay,
} from '@/database/requirement';
import { User } from '@/database/user';
import { act, cleanup, render, screen } from '@testing-library/react';
import { createContext } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TaskDialog, TaskDialogView } from './TaskDialog';
import { TrainingPlanContext } from './TrainingPlanTab';

vi.mock('@/api/cache/requirements', () => ({
    useRequirements: () => ({ requirements: [] }),
}));

vi.mock('@/auth/Auth', () => ({
    useAuth: () => ({ user: makeUser([]) }),
    useFreeTier: () => false,
}));

vi.mock('@/components/profile/activity/useTimeline', () => ({
    useTimelineContext: () => ({ entries: [] }),
}));

vi.mock('@/board/pgn/boardTools/underboard/clock/ClockUsage', () => ({
    formatTime: (seconds: number) => `${seconds}s`,
}));

vi.mock('@/components/profile/trainingPlan/DeleteCustomTaskModal', () => ({
    default: () => null,
}));

vi.mock('@/components/profile/trainingPlan/Position', () => ({
    default: () => null,
}));

vi.mock('@/components/profile/trainingPlan/ProgressHistory', () => ({
    default: () => null,
}));

vi.mock('@/components/profile/trainingPlan/ProgressUpdater', () => ({
    ProgressUpdater: () => null,
}));

vi.mock('@/components/ui/ModalTitle', () => ({
    default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('./CustomTaskEditor', () => ({
    default: () => null,
}));

vi.mock('./TaskDescription', () => ({
    TaskDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('./TrainingPlanTab', () => ({
    TrainingPlanContext: createContext(null),
}));

vi.mock('@/components/timer/TimerContext', () => ({
    TimerContext: createContext({
        timerSeconds: 0,
        isRunning: false,
        isPaused: false,
        task: undefined,
        showTask: false,
        setShowTask: () => undefined,
        onStart: () => undefined,
        onPause: () => undefined,
        onToggle: () => undefined,
        onClear: () => undefined,
        getLabel: () => 'Start Timer',
    }),
}));

const mockFreeUser: User = {
    username: 'test-user',
    displayName: 'Test User',
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
    archivedTasks: [],
};

function makeRequirement(id: string): Requirement {
    return {
        id,
        status: RequirementStatus.Active,
        category: RequirementCategory.Games,
        name: `Task ${id}`,
        description: 'Task description',
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

function makeUser(archivedTasks: string[]): User {
    return {
        ...mockFreeUser,
        archivedTasks,
    };
}

function renderTaskDialog({
    archivedTasks = [],
    isCurrentUser = true,
    isArchivableTaskId = () => true,
    toggleArchived = vi.fn(),
}: {
    archivedTasks?: string[];
    isCurrentUser?: boolean;
    isArchivableTaskId?: (taskId: string) => boolean;
    toggleArchived?: ReturnType<typeof vi.fn>;
}) {
    const task = makeRequirement('task-1');
    const user = makeUser(archivedTasks);

    render(
        <TrainingPlanContext
            value={
                {
                    user,
                    isCurrentUser,
                    toggleArchived,
                    isArchivableTaskId,
                } as never
            }
        >
            <TaskDialog
                open
                onClose={() => undefined}
                task={task}
                initialView={TaskDialogView.Details}
                progress={undefined}
                cohort='1400-1500'
            />
        </TrainingPlanContext>,
    );

    return { task, toggleArchived };
}

function renderTaskDialogWithoutTrainingPlanContext() {
    const task = makeRequirement('task-1');

    render(
        <TaskDialog
            open
            onClose={() => undefined}
            task={task}
            initialView={TaskDialogView.Details}
            progress={undefined}
            cohort='1400-1500'
        />,
    );
}

describe('TaskDialog', () => {
    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    describe('Archive Task Button', () => {
        it('shows Archive Task for current users when task is not archived', () => {
            renderTaskDialog({ archivedTasks: [] });

            expect(screen.getByRole('button', { name: 'Archive Task' })).toBeInTheDocument();
        });

        it('shows Unarchive Task for current users when task is archived', () => {
            renderTaskDialog({ archivedTasks: ['task-1'] });

            expect(screen.getByRole('button', { name: 'Unarchive Task' })).toBeInTheDocument();
        });

        it('disables the archive button when the task cannot be archived', () => {
            renderTaskDialog({ isArchivableTaskId: () => false });

            expect(screen.getByRole('button', { name: 'Archive Task' })).toBeDisabled();
        });

        it('does not show archive controls for non-current users', () => {
            renderTaskDialog({ isCurrentUser: false });

            expect(screen.queryByRole('button', { name: 'Archive Task' })).not.toBeInTheDocument();
            expect(
                screen.queryByRole('button', { name: 'Unarchive Task' }),
            ).not.toBeInTheDocument();
        });

        it('calls toggleArchived when archive button is clicked', () => {
            const toggleArchived = vi.fn();
            const { task } = renderTaskDialog({ toggleArchived });

            const archiveButton = screen.getByRole('button', {
                name: 'Archive Task',
            });

            act(() => archiveButton.click());

            expect(toggleArchived).toHaveBeenCalledWith(task);
        });

        it('does not show archive controls without valid TrainingPlanContext', () => {
            renderTaskDialogWithoutTrainingPlanContext();

            expect(screen.queryByRole('button', { name: 'Archive Task' })).not.toBeInTheDocument();
            expect(
                screen.queryByRole('button', { name: 'Unarchive Task' }),
            ).not.toBeInTheDocument();
        });
    });
});
