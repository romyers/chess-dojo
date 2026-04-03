import {
    Requirement,
    RequirementCategory,
    RequirementStatus,
    ScoreboardDisplay,
} from '@/database/requirement';
import { User } from '@/database/user';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FullTrainingPlanItem } from './FullTrainingPlanItem';

vi.mock('@/api/cache/requirements', () => ({
    useRequirements: () => ({ requirements: [] }),
}));

vi.mock('../../activity/useTimeline', () => ({
    useTimelineContext: () => ({ entries: [] }),
}));

vi.mock('@/scoreboard/ScoreboardProgress', () => ({
    __esModule: true,
    default: () => null,
    ProgressText: () => null,
}));

vi.mock('../daily/TaskTimerIconButton', () => ({
    TaskTimerIconButton: () => null,
}));

vi.mock('../suggestedTasks', () => ({
    MINIMUM_TASKS: new Set(),
}));

vi.mock('../TaskDialog', () => ({
    TaskDialog: () => null,
    TaskDialogView: {
        Details: 'DETAILS',
        Progress: 'PROGRESS',
    },
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

const mockUser: User = {
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
};

function renderItem(isArchived: boolean) {
    render(
        <FullTrainingPlanItem
            user={mockUser}
            requirement={makeRequirement('task-1')}
            cohort='1400-1500'
            isCurrentUser
            togglePin={() => undefined}
            isPinned={false}
            isArchived={isArchived}
        />,
    );
}

describe('FullTrainingPlanItem', () => {
    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    describe('Archived Training Plan Item', () => {
        it('grays out archived items', () => {
            renderItem(true);

            expect(screen.getByTestId('Task-task-1-training-plan-entry')).toHaveStyle({
                opacity: '0.5',
            });
        });

        it('does not gray out unarchived items', () => {
            renderItem(false);

            expect(screen.getByTestId('Task-task-1-training-plan-entry')).toHaveStyle({
                opacity: '1',
            });
        });

        it('shows Archived chip when item is archived', () => {
            renderItem(true);

            expect(screen.getByTestId('Task-task-1-training-plan-entry')).toHaveTextContent(
                'Archived',
            );
        });

        it('does not show Archived chip when item is not archived', () => {
            renderItem(false);

            expect(screen.getByTestId('Task-task-1-training-plan-entry')).not.toHaveTextContent(
                'Archived',
            );
        });
    });
});
