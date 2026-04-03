import {
    Requirement,
    RequirementCategory,
    RequirementStatus,
    ScoreboardDisplay,
} from '@/database/requirement';
import { User } from '@/database/user';
import { useMediaQuery } from '@mui/material';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type MockedFunction } from 'vitest';
import { TrainingPlanContext } from '../TrainingPlanTab';
import { FullTrainingPlan } from './FullTrainingPlan';
import { GRADUATION_TASK_ID } from './FullTrainingPlanSection';

interface MockSectionProps {
    section: {
        category: RequirementCategory;
        archivedTaskIds: Set<string>;
    };
    showArchived: boolean;
}

const USER_COHORT = '1400-1500';
const OTHER_COHORT = '1800-1900';

const spies = vi.hoisted(() => ({
    sectionProps: vi.fn(),
    localStorageData: {
        setShowArchived: vi.fn(),
    },
}));

vi.mock('../TrainingPlanTab', async () => {
    const React = await vi.importActual<typeof import('react')>('react');
    return {
        TrainingPlanContext: React.createContext(null as never),
    };
});

vi.mock('@mui/material', async () => {
    const actual = await vi.importActual<typeof import('@mui/material')>('@mui/material');
    return {
        ...actual,
        useMediaQuery: vi.fn(() => false),
    };
});

vi.mock('usehooks-ts', async () => {
    const React = await vi.importActual<typeof import('react')>('react');
    return {
        useLocalStorage: (_key: string, initialValue: boolean) => {
            const [showArchived, setShowArchived] = React.useState(initialValue);
            return [
                showArchived,
                (value: boolean) => {
                    spies.localStorageData.setShowArchived(value);
                    setShowArchived(value);
                },
            ] as const;
        },
    };
});

vi.mock('./FullTrainingPlanSection', () => {
    return {
        GRADUATION_TASK_ID: 'GRADUATION_TASK',
        FullTrainingPlanSection: spies.sectionProps,
    };
});

function makeRequirement(id: string, isFree = true): Requirement {
    return {
        id,
        status: RequirementStatus.Active,
        category: RequirementCategory.Games,
        name: `Task ${id}`,
        description: '',
        freeDescription: '',
        counts: { [USER_COHORT]: 1 },
        startCount: 0,
        numberOfCohorts: 1,
        unitScore: 0,
        totalScore: 1,
        scoreboardDisplay: ScoreboardDisplay.ProgressBar,
        progressBarSuffix: '',
        updatedAt: '2026-01-01T00:00:00Z',
        sortPriority: id,
        expirationDays: -1,
        isFree: isFree,
        atomic: false,
        expectedMinutes: 0,
        subscriptionTiers: isFree
            ? (['FREE', 'BASIC', 'LECTURE', 'GAME_REVIEW'] as Requirement['subscriptionTiers'])
            : (['BASIC', 'LECTURE', 'GAME_REVIEW'] as Requirement['subscriptionTiers']),
    };
}

const mockFreeUser: User = {
    username: '',
    displayName: '',
    discordUsername: '',
    dojoCohort: USER_COHORT,
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

function renderTrainingPlan(
    archivedTaskIds: string[],
    userCohort: string,
    userIsFree = true,
    currentUser = true,
) {
    const user = userIsFree
        ? { ...mockFreeUser, dojoCohort: userCohort, archivedTaskIds: archivedTaskIds }
        : {
              ...mockFreeUser,
              dojoCohort: userCohort,
              archivedTaskIds: archivedTaskIds,
              subscriptionTier: 'BASIC' as User['subscriptionTier'],
              subscriptionStatus: 'SUBSCRIBED' as User['subscriptionStatus'],
          };

    const allRequirements = [
        makeRequirement('free-task', true),
        { ...makeRequirement('free-task-2', true), category: RequirementCategory.Opening },
        makeRequirement('paid-task', false),
    ];

    const contextValue = {
        user: user,
        timeline: [],
        request: {
            isLoading: () => false,
        },
        requirements: allRequirements,
        allRequirements,
        pinnedTasks: [],
        archivedTaskIds,
        togglePin: () => undefined,
        toggleArchived: () => undefined,
        isCurrentUser: currentUser,
        skippedTaskIds: [],
        toggleSkip: () => undefined,
        isArchivableTaskId: () => true,
        suggestionsByDay: [],
        weekSuggestions: [],
        startDate: '',
        endDate: '',
        isLoading: false,
    };

    render(
        <TrainingPlanContext value={contextValue as never}>
            <FullTrainingPlan cohort={userCohort} setCohort={() => 0} />
        </TrainingPlanContext>,
    );
}

describe(`FullTrainingPlan`, () => {
    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    describe(`"Show Archived Tasks" checkbox`, () => {
        describe('Visibility conditions', () => {
            it('displays the correct button for large screens', () => {
                // Defensively make sure the media query is mocked to false
                (useMediaQuery as MockedFunction<typeof useMediaQuery>).mockReturnValue(false);

                renderTrainingPlan(['free-task'], USER_COHORT);

                const button = screen.getByRole('button', { name: 'Show Archived Tasks' });

                // It should be a text button
                expect(button.textContent).toBe('Show Archived Tasks');
            });

            it('hides the Show Archived Tasks checkbox when there are no archived tasks', () => {
                renderTrainingPlan([], USER_COHORT);

                expect(
                    screen.queryByRole('button', { name: 'Show Archived Tasks' }),
                ).not.toBeInTheDocument();
            });

            it('shows the Show Archived Tasks checkbox when free users have archived free tasks in the visible cohort', () => {
                renderTrainingPlan(['free-task', 'free-task-2', 'paid-task'], USER_COHORT);

                expect(
                    screen.getByRole('button', { name: 'Show Archived Tasks' }),
                ).toBeInTheDocument();
            });

            it('shows the Show Archived Tasks checkbox when paid users have paid archived tasks in the visible cohort', () => {
                renderTrainingPlan(['paid-task'], USER_COHORT, false);

                expect(
                    screen.getByRole('button', { name: 'Show Archived Tasks' }),
                ).toBeInTheDocument();
            });

            it('shows the Show Archived Tasks checkbox when paid users have free archived tasks in the visible cohort', () => {
                renderTrainingPlan(['free-task'], USER_COHORT, false);

                expect(
                    screen.getByRole('button', { name: 'Show Archived Tasks' }),
                ).toBeInTheDocument();
            });

            it('hides the Show Archived Tasks checkbox when archived tasks are not in the visible cohort', () => {
                renderTrainingPlan(['free-task'], OTHER_COHORT);

                expect(
                    screen.queryByRole('button', { name: 'Show Archived Tasks' }),
                ).not.toBeInTheDocument();
            });

            it('hides the Show Archived Tasks checkbox when free users have only paid archived tasks', () => {
                renderTrainingPlan(['paid-task'], USER_COHORT, true);

                expect(
                    screen.queryByRole('button', { name: 'Show Archived Tasks' }),
                ).not.toBeInTheDocument();
            });

            it('hides the Show Archived Tasks checkbox when archived task ids are not in the training plan', () => {
                renderTrainingPlan(['task-not-in-plan'], USER_COHORT);

                expect(
                    screen.queryByRole('button', { name: 'Show Archived Tasks' }),
                ).not.toBeInTheDocument();
            });

            it('hides the Show Archived Tasks checkbox for non-current users', () => {
                renderTrainingPlan(['free-task'], USER_COHORT, true, false);

                expect(
                    screen.queryByRole('button', { name: 'Show Archived Tasks' }),
                ).not.toBeInTheDocument();
            });
        });

        describe('Functionality', () => {
            it('shows archived tasks when Show Archived Tasks is checked', () => {
                renderTrainingPlan(['free-task'], USER_COHORT);

                const showArchivedButton = screen.getByRole('button', {
                    name: 'Show Archived Tasks',
                });

                // Toggle to checked
                act(() => showArchivedButton.click());

                expect(spies.sectionProps.mock.calls.at(-1)?.[0]).toHaveProperty(
                    'showArchived',
                    true,
                );
            });

            it('hides archived tasks when Show Archived Tasks is unchecked', () => {
                renderTrainingPlan(['free-task'], USER_COHORT);

                const showArchivedButton = screen.getByRole('button', {
                    name: 'Show Archived Tasks',
                });

                // Toggle to unchecked
                act(() => showArchivedButton.click());
                act(() => showArchivedButton.click());

                expect(spies.sectionProps.mock.calls.at(-1)?.[0]).toHaveProperty(
                    'showArchived',
                    false,
                );
            });

            it('persists Show Archived Tasks state in localStorage', () => {
                renderTrainingPlan(['free-task'], USER_COHORT);

                const showArchivedButton = screen.getByRole('button', {
                    name: 'Show Archived Tasks',
                });

                // Toggle to checked
                act(() => showArchivedButton.click());

                expect(spies.localStorageData.setShowArchived).toHaveBeenLastCalledWith(true);

                // Toggle to unchecked
                act(() => showArchivedButton.click());

                expect(spies.localStorageData.setShowArchived).toHaveBeenLastCalledWith(false);
            });
        });

        describe('Small screen visibility conditions', () => {
            beforeEach(() => {
                (useMediaQuery as MockedFunction<typeof useMediaQuery>).mockReturnValue(true);
            });

            it('displays the correct button for small screens', () => {
                renderTrainingPlan(['free-task'], USER_COHORT);

                const button = screen.getByRole('button', { name: 'Show Archived Tasks' });

                // It should be an icon button with no text
                expect(button.textContent).toBe('');
            });

            it('hides the Show Archived Tasks checkbox when there are no archived tasks', () => {
                renderTrainingPlan([], USER_COHORT);

                expect(
                    screen.queryByRole('button', { name: 'Show Archived Tasks' }),
                ).not.toBeInTheDocument();
            });

            it('shows the Show Archived Tasks checkbox when free users have archived free tasks in the visible cohort', () => {
                renderTrainingPlan(['free-task', 'free-task-2', 'paid-task'], USER_COHORT);

                expect(
                    screen.getByRole('button', { name: 'Show Archived Tasks' }),
                ).toBeInTheDocument();
            });

            it('shows the Show Archived Tasks checkbox when paid users have paid archived tasks in the visible cohort', () => {
                renderTrainingPlan(['paid-task'], USER_COHORT, false);

                expect(
                    screen.getByRole('button', { name: 'Show Archived Tasks' }),
                ).toBeInTheDocument();
            });

            it('shows the Show Archived Tasks checkbox when paid users have free archived tasks in the visible cohort', () => {
                renderTrainingPlan(['free-task'], USER_COHORT, false);

                expect(
                    screen.getByRole('button', { name: 'Show Archived Tasks' }),
                ).toBeInTheDocument();
            });

            it('hides the Show Archived Tasks checkbox when archived tasks are not in the visible cohort', () => {
                renderTrainingPlan(['free-task'], OTHER_COHORT);

                expect(
                    screen.queryByRole('button', { name: 'Show Archived Tasks' }),
                ).not.toBeInTheDocument();
            });

            it('hides the Show Archived Tasks checkbox when free users have only paid archived tasks', () => {
                renderTrainingPlan(['paid-task'], USER_COHORT, true);

                expect(
                    screen.queryByRole('button', { name: 'Show Archived Tasks' }),
                ).not.toBeInTheDocument();
            });

            it('hides the Show Archived Tasks checkbox when archived task ids are not in the training plan', () => {
                renderTrainingPlan(['task-not-in-plan'], USER_COHORT);

                expect(
                    screen.queryByRole('button', { name: 'Show Archived Tasks' }),
                ).not.toBeInTheDocument();
            });

            it('hides the Show Archived Tasks checkbox for non-current users', () => {
                renderTrainingPlan(['free-task'], USER_COHORT, true, false);

                expect(
                    screen.queryByRole('button', { name: 'Show Archived Tasks' }),
                ).not.toBeInTheDocument();
            });
        });
    });

    describe('Archived Tasks in Sections', () => {
        it("passes IDs of archived tasks to the task's section", () => {
            renderTrainingPlan(['free-task'], USER_COHORT);

            const sectionCalls = spies.sectionProps.mock.calls as unknown as MockSectionProps[][];

            const freeTaskSectionProps = sectionCalls.find(
                (call) => call[0]?.section.category === RequirementCategory.Games,
            )?.[0];

            expect(freeTaskSectionProps?.section?.archivedTaskIds).toEqual(new Set(['free-task']));
        });

        it('does not pass IDs of archived tasks to different sections', () => {
            renderTrainingPlan(['free-task'], USER_COHORT);

            const sectionCalls = spies.sectionProps.mock.calls as unknown as MockSectionProps[][];

            const freeTaskSectionProps = sectionCalls.find(
                (call) => call[0]?.section.category === RequirementCategory.Opening,
            )?.[0];

            expect(freeTaskSectionProps?.section?.archivedTaskIds).toEqual(new Set<string>());
        });

        it("does not pass IDs of archived tasks to sections when on another user's profile", () => {
            renderTrainingPlan(['free-task'], USER_COHORT, true, false);

            const sectionCalls = spies.sectionProps.mock.calls as unknown as MockSectionProps[][];

            const freeTaskSectionProps = sectionCalls.find(
                (call) => call[0]?.section.category === RequirementCategory.Games,
            )?.[0];

            expect(freeTaskSectionProps?.section?.archivedTaskIds).toEqual(new Set<string>());
        });

        it('does not archive graduation tasks', () => {
            renderTrainingPlan([GRADUATION_TASK_ID], USER_COHORT);

            const sectionCalls = spies.sectionProps.mock.calls as unknown as MockSectionProps[][];

            const graduationSectionProps = sectionCalls.find(
                (call) => call[0]?.section.category === RequirementCategory.Graduation,
            )?.[0];

            expect(graduationSectionProps?.section?.archivedTaskIds).toEqual(new Set<string>());
        });
    });
});
