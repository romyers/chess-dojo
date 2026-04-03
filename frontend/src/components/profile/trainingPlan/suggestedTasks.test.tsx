import {
    Requirement,
    RequirementCategory,
    RequirementStatus,
    ScoreboardDisplay,
} from '@/database/requirement';
import { User, WeeklyPlan } from '@/database/user';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskSuggestionAlgorithm } from './suggestedTasks';

const USER_COHORT = '1400-1500';

const MOCK_TODAY = new Date(Date.UTC(2026, 3, 1)); // April 1, 2026

const mockFreeUser: User = {
    username: 'test-user',
    displayName: 'Test User',
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
    pinnedTasks: [],
    archivedTasks: [],
};

function makeRequirement(id: string, category = RequirementCategory.Games): Requirement {
    return {
        id,
        status: RequirementStatus.Active,
        category,
        name: `Task ${id}`,
        description: '',
        freeDescription: '',
        counts: { [USER_COHORT]: 1000 },
        startCount: 0,
        numberOfCohorts: 1,
        unitScore: 1,
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

function makeWeeklyPlan(overrides: Partial<WeeklyPlan> = {}): WeeklyPlan {
    return {
        endDate: '2099-01-01T00:00:00.000Z',
        progressUpdatedAt: '',
        pinnedTasks: [],
        archivedTasks: [],
        nextGame: '',
        tasks: Array.from({ length: 7 }, () => []),
        ...overrides,
    };
}

function makeUser(overrides: Partial<User> = {}): User {
    return {
        ...mockFreeUser,
        ...overrides,
    };
}

describe('suggestedTasks', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(MOCK_TODAY);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('Archived Tasks Handling', () => {
        describe('Should Regenerate Detection', () => {
            describe('ShouldRegenerateToday', () => {
                it('is false when both plans have undefined archived task arrays', () => {
                    const req = makeRequirement('task');
                    const user = makeUser({ archivedTasks: undefined });
                    const algo = new TaskSuggestionAlgorithm(user, [req], [req], []);

                    expect(
                        algo.shouldRegenerateToday(
                            algo.getGenerationReason(
                                new Date(),
                                makeWeeklyPlan({ archivedTasks: undefined }),
                            ),
                        ),
                    ).toBe(false);
                });

                it('is false when new plan has an undefined archived task array and existing plan has an empty archived task array', () => {
                    const req = makeRequirement('task');
                    const user = makeUser({ archivedTasks: undefined });
                    const algo = new TaskSuggestionAlgorithm(user, [req], [req], []);

                    expect(
                        algo.shouldRegenerateToday(
                            algo.getGenerationReason(
                                new Date(),
                                makeWeeklyPlan({ archivedTasks: [] }),
                            ),
                        ),
                    ).toBe(false);
                });

                it('is false when both plans have empty archived task arrays', () => {
                    const req = makeRequirement('task');
                    const user = makeUser({ archivedTasks: [] });
                    const algo = new TaskSuggestionAlgorithm(user, [req], [req], []);

                    expect(
                        algo.shouldRegenerateToday(
                            algo.getGenerationReason(
                                new Date(),
                                makeWeeklyPlan({ archivedTasks: [] }),
                            ),
                        ),
                    ).toBe(false);
                });

                it('is true when new plan has archived tasks but existing plan has an undefined archived task array', () => {
                    const req = makeRequirement('task');
                    const user = makeUser({ archivedTasks: ['task'] });
                    const algo = new TaskSuggestionAlgorithm(user, [req], [req], []);

                    expect(
                        algo.shouldRegenerateToday(
                            algo.getGenerationReason(
                                new Date(),
                                makeWeeklyPlan({ archivedTasks: undefined }),
                            ),
                        ),
                    ).toBe(true);
                });

                it('is true when archived tasks are added where none existed', () => {
                    const req = makeRequirement('task');
                    const user = makeUser({ archivedTasks: ['task'] });
                    const algo = new TaskSuggestionAlgorithm(user, [req], [req], []);

                    expect(
                        algo.shouldRegenerateToday(
                            algo.getGenerationReason(
                                new Date(),
                                makeWeeklyPlan({ archivedTasks: [] }),
                            ),
                        ),
                    ).toBe(true);
                });

                it('is true when archived tasks are added when some already exist', () => {
                    const req = makeRequirement('task');
                    const req2 = makeRequirement('task-2');
                    const user = makeUser({ archivedTasks: ['task', 'task-2'] });
                    const algo = new TaskSuggestionAlgorithm(user, [req, req2], [req, req2], []);

                    expect(
                        algo.shouldRegenerateToday(
                            algo.getGenerationReason(
                                new Date(),
                                makeWeeklyPlan({ archivedTasks: ['task'] }),
                            ),
                        ),
                    ).toBe(true);
                });

                it('is true when archived tasks are changed but are still the same number of archived tasks', () => {
                    const req = makeRequirement('task');
                    const req2 = makeRequirement('task-2');
                    const req3 = makeRequirement('task-3');
                    const user = makeUser({ archivedTasks: ['task', 'task-2'] });
                    const algo = new TaskSuggestionAlgorithm(
                        user,
                        [req, req2, req3],
                        [req, req2, req3],
                        [],
                    );

                    expect(
                        algo.shouldRegenerateToday(
                            algo.getGenerationReason(
                                new Date(),
                                makeWeeklyPlan({ archivedTasks: ['task', 'task-3'] }),
                            ),
                        ),
                    ).toBe(true);
                });

                it('is true when archived tasks are removed', () => {
                    const req = makeRequirement('task');
                    const req2 = makeRequirement('task-2');
                    const user = makeUser({ archivedTasks: ['task'] });
                    const algo = new TaskSuggestionAlgorithm(user, [req, req2], [req, req2], []);

                    expect(
                        algo.shouldRegenerateToday(
                            algo.getGenerationReason(
                                new Date(),
                                makeWeeklyPlan({ archivedTasks: ['task', 'task-2'] }),
                            ),
                        ),
                    ).toBe(true);
                });

                it('is false when archived tasks reordered but not changed', () => {
                    const req = makeRequirement('task');
                    const req2 = makeRequirement('task-2');
                    const user = makeUser({ archivedTasks: ['task', 'task-2'] });
                    const algo = new TaskSuggestionAlgorithm(user, [req, req2], [req, req2], []);

                    expect(
                        algo.shouldRegenerateToday(
                            algo.getGenerationReason(
                                new Date(),
                                makeWeeklyPlan({ archivedTasks: ['task-2', 'task'] }),
                            ),
                        ),
                    ).toBe(false);
                });

                it('is false when archived tasks are present but have not changed', () => {
                    const req = makeRequirement('task');
                    const user = makeUser({ archivedTasks: ['task'] });
                    const algo = new TaskSuggestionAlgorithm(user, [req], [req], []);

                    expect(
                        algo.shouldRegenerateToday(
                            algo.getGenerationReason(
                                new Date(),
                                makeWeeklyPlan({ archivedTasks: ['task'] }),
                            ),
                        ),
                    ).toBe(false);
                });

                it('is false when there are no archived tasks and none were added', () => {
                    const req = makeRequirement('task');
                    const user = makeUser({ archivedTasks: [] });
                    const algo = new TaskSuggestionAlgorithm(user, [req], [req], []);

                    expect(
                        algo.shouldRegenerateToday(
                            algo.getGenerationReason(
                                new Date(),
                                makeWeeklyPlan({ archivedTasks: [] }),
                            ),
                        ),
                    ).toBe(false);
                });

                // Will fail if the if statements in getGenerationReason are misordered
                it('is true when archived tasks and progressUpdatedAt are both changed', () => {
                    const req = makeRequirement('task');
                    const oldUpdateTime = '2026-04-01T00:00:00Z';
                    const newUpdateTime = '2026-04-02T01:00:00Z';
                    const user = makeUser({
                        archivedTasks: ['task'],
                        progress: {
                            [req.id]: {
                                requirementId: req.id,
                                minutesSpent: {},
                                updatedAt: newUpdateTime,
                            },
                        },
                    });
                    const algo = new TaskSuggestionAlgorithm(user, [req], [req], []);

                    expect(
                        algo.shouldRegenerateToday(
                            algo.getGenerationReason(
                                new Date(),
                                makeWeeklyPlan({
                                    archivedTasks: [],
                                    progressUpdatedAt: oldUpdateTime,
                                }),
                            ),
                        ),
                    ).toBe(true);
                });

                // Will fail if the if statements in getGenerationReason are misordered
                it('is true when archived tasks and work goals are both changed', () => {
                    const req = makeRequirement('task');
                    const user = makeUser({
                        archivedTasks: ['task'],
                        workGoal: {
                            minutesPerDay: [60, 60, 60, 60, 60, 60, 60],
                        },
                    });
                    const algo = new TaskSuggestionAlgorithm(user, [req], [req], []);

                    expect(
                        algo.shouldRegenerateToday(
                            algo.getGenerationReason(
                                new Date(),
                                makeWeeklyPlan({
                                    archivedTasks: [],
                                    tasks: [[{ id: req.id, minutes: 10 }], [], [], [], [], [], []],
                                }),
                            ),
                        ),
                    ).toBe(true);
                });

                // Will fail if the if statements in getGenerationReason are misordered
                it('is true when archived tasks have changed and future upcoming games have changed', () => {
                    const req = makeRequirement('task');
                    const user = makeUser({
                        archivedTasks: ['task'],
                        gameSchedule: [
                            {
                                date: '2026-04-08T01:00:00Z',
                                count: 1,
                            },
                        ],
                    });
                    const algo = new TaskSuggestionAlgorithm(user, [req], [req], []);

                    expect(
                        algo.shouldRegenerateToday(
                            algo.getGenerationReason(
                                new Date(),
                                makeWeeklyPlan({
                                    archivedTasks: [],
                                    nextGame: '2026-04-05T01:00:00Z',
                                }),
                            ),
                        ),
                    ).toBe(true);
                });
            });

            describe('ShouldRegenerateFuture', () => {
                it('is false when both plans have undefined archived task arrays', () => {
                    const req = makeRequirement('task');
                    const user = makeUser({ archivedTasks: undefined });
                    const algo = new TaskSuggestionAlgorithm(user, [req], [req], []);

                    expect(
                        algo.shouldRegenerateFuture(
                            algo.getGenerationReason(
                                new Date(),
                                makeWeeklyPlan({ archivedTasks: undefined }),
                            ),
                        ),
                    ).toBe(false);
                });

                it('is false when new plan has an undefined archived task array and existing plan has an empty archived task array', () => {
                    const req = makeRequirement('task');
                    const user = makeUser({ archivedTasks: undefined });
                    const algo = new TaskSuggestionAlgorithm(user, [req], [req], []);

                    expect(
                        algo.shouldRegenerateFuture(
                            algo.getGenerationReason(
                                new Date(),
                                makeWeeklyPlan({ archivedTasks: [] }),
                            ),
                        ),
                    ).toBe(false);
                });

                it('is false when both plans have empty archived task arrays', () => {
                    const req = makeRequirement('task');
                    const user = makeUser({ archivedTasks: [] });
                    const algo = new TaskSuggestionAlgorithm(user, [req], [req], []);

                    expect(
                        algo.shouldRegenerateFuture(
                            algo.getGenerationReason(
                                new Date(),
                                makeWeeklyPlan({ archivedTasks: [] }),
                            ),
                        ),
                    ).toBe(false);
                });

                it('is true when new plan has archived tasks but existing plan has an undefined archived task array', () => {
                    const req = makeRequirement('task');
                    const user = makeUser({ archivedTasks: ['task'] });
                    const algo = new TaskSuggestionAlgorithm(user, [req], [req], []);

                    expect(
                        algo.shouldRegenerateFuture(
                            algo.getGenerationReason(
                                new Date(),
                                makeWeeklyPlan({ archivedTasks: undefined }),
                            ),
                        ),
                    ).toBe(true);
                });

                it('is true when archived tasks are added where none existed', () => {
                    const req = makeRequirement('task');
                    const user = makeUser({ archivedTasks: ['task'] });
                    const algo = new TaskSuggestionAlgorithm(user, [req], [req], []);

                    expect(
                        algo.shouldRegenerateFuture(
                            algo.getGenerationReason(
                                new Date(),
                                makeWeeklyPlan({ archivedTasks: [] }),
                            ),
                        ),
                    ).toBe(true);
                });

                it('is true when archived tasks are added when some already exist', () => {
                    const req = makeRequirement('task');
                    const req2 = makeRequirement('task-2');
                    const user = makeUser({ archivedTasks: ['task', 'task-2'] });
                    const algo = new TaskSuggestionAlgorithm(user, [req, req2], [req, req2], []);

                    expect(
                        algo.shouldRegenerateFuture(
                            algo.getGenerationReason(
                                new Date(),
                                makeWeeklyPlan({ archivedTasks: ['task'] }),
                            ),
                        ),
                    ).toBe(true);
                });

                it('is true when archived tasks are changed but are still the same number of archived tasks', () => {
                    const req = makeRequirement('task');
                    const req2 = makeRequirement('task-2');
                    const req3 = makeRequirement('task-3');
                    const user = makeUser({ archivedTasks: ['task', 'task-2'] });
                    const algo = new TaskSuggestionAlgorithm(
                        user,
                        [req, req2, req3],
                        [req, req2, req3],
                        [],
                    );

                    expect(
                        algo.shouldRegenerateFuture(
                            algo.getGenerationReason(
                                new Date(),
                                makeWeeklyPlan({ archivedTasks: ['task', 'task-3'] }),
                            ),
                        ),
                    ).toBe(true);
                });

                it('is true when archived tasks are removed', () => {
                    const req = makeRequirement('task');
                    const req2 = makeRequirement('task-2');
                    const user = makeUser({ archivedTasks: ['task'] });
                    const algo = new TaskSuggestionAlgorithm(user, [req, req2], [req, req2], []);

                    expect(
                        algo.shouldRegenerateFuture(
                            algo.getGenerationReason(
                                new Date(),
                                makeWeeklyPlan({ archivedTasks: ['task', 'task-2'] }),
                            ),
                        ),
                    ).toBe(true);
                });

                it('is false when archived tasks are present but have not changed', () => {
                    const req = makeRequirement('task');
                    const user = makeUser({ archivedTasks: ['task'] });
                    const algo = new TaskSuggestionAlgorithm(user, [req], [req], []);

                    expect(
                        algo.shouldRegenerateFuture(
                            algo.getGenerationReason(
                                new Date(),
                                makeWeeklyPlan({ archivedTasks: ['task'] }),
                            ),
                        ),
                    ).toBe(false);
                });

                it('is false when there are no archived tasks and none were added', () => {
                    const req = makeRequirement('task');
                    const user = makeUser({ archivedTasks: [] });
                    const algo = new TaskSuggestionAlgorithm(user, [req], [req], []);

                    expect(
                        algo.shouldRegenerateFuture(
                            algo.getGenerationReason(
                                new Date(),
                                makeWeeklyPlan({ archivedTasks: [] }),
                            ),
                        ),
                    ).toBe(false);
                });

                it('is false when archived tasks reordered but not changed', () => {
                    const req = makeRequirement('task');
                    const req2 = makeRequirement('task-2');
                    const user = makeUser({ archivedTasks: ['task', 'task-2'] });
                    const algo = new TaskSuggestionAlgorithm(user, [req, req2], [req, req2], []);

                    expect(
                        algo.shouldRegenerateFuture(
                            algo.getGenerationReason(
                                new Date(),
                                makeWeeklyPlan({ archivedTasks: ['task-2', 'task'] }),
                            ),
                        ),
                    ).toBe(false);
                });

                it('is false when archived tasks have duplicates in new plan but not in existing plan', () => {
                    const req = makeRequirement('task');
                    const user = makeUser({ archivedTasks: ['task', 'task'] });
                    const algo = new TaskSuggestionAlgorithm(user, [req], [req], []);

                    expect(
                        algo.shouldRegenerateFuture(
                            algo.getGenerationReason(
                                new Date(),
                                makeWeeklyPlan({ archivedTasks: ['task'] }),
                            ),
                        ),
                    ).toBe(false);
                });

                it('is false when archived tasks have duplicates in existing plan but not in new plan', () => {
                    const req = makeRequirement('task');
                    const user = makeUser({ archivedTasks: ['task'] });
                    const algo = new TaskSuggestionAlgorithm(user, [req], [req], []);

                    expect(
                        algo.shouldRegenerateFuture(
                            algo.getGenerationReason(
                                new Date(),
                                makeWeeklyPlan({ archivedTasks: ['task', 'task'] }),
                            ),
                        ),
                    ).toBe(false);
                });
            });
        });
        describe('Exclusion from suggestions', () => {
            describe('getSuggestedTasks', () => {
                it('does not suggest pinned archived tasks', () => {
                    const req = makeRequirement('task');
                    const user = makeUser({
                        pinnedTasks: ['task'],
                        archivedTasks: ['task'],
                    });
                    const algo = new TaskSuggestionAlgorithm(user, [req], [req], []);

                    const suggested = algo.getSuggestedTasks(new Date());

                    expect(suggested.map((t) => t.id)).not.toContain('task');
                });

                it('does not suggest otherwise-eligible archived tasks', () => {
                    const req = makeRequirement('task');
                    const user = makeUser({
                        archivedTasks: ['task'],
                    });
                    const algo = new TaskSuggestionAlgorithm(user, [req], [req], []);

                    const suggested = algo.getSuggestedTasks(new Date());

                    expect(suggested.map((t) => t.id)).not.toContain('task');
                });

                it('still suggests eligible non-archived tasks', () => {
                    const req = makeRequirement('task');
                    const user = makeUser({
                        archivedTasks: [],
                    });
                    const algo = new TaskSuggestionAlgorithm(user, [req], [req], []);

                    const suggested = algo.getSuggestedTasks(new Date());

                    expect(suggested.map((t) => t.id)).toContain('task');
                });
            });
            describe('getWelcomeTasks', () => {
                it('does not suggest pinned archived welcome tasks', () => {
                    const welcomeTask = makeRequirement('welcome', RequirementCategory.Welcome);
                    const user = makeUser({
                        pinnedTasks: ['welcome'],
                        archivedTasks: ['welcome'],
                    });
                    const algo = new TaskSuggestionAlgorithm(
                        user,
                        [welcomeTask],
                        [welcomeTask],
                        [],
                    );

                    const suggested = algo.getWelcomeTasks();

                    expect(suggested.map((s) => s.task.id)).not.toContain('welcome');
                });

                it('does not suggest otherwise-eligible archived welcome tasks', () => {
                    const welcomeTask = makeRequirement('welcome', RequirementCategory.Welcome);
                    const user = makeUser({
                        archivedTasks: ['welcome'],
                    });
                    const algo = new TaskSuggestionAlgorithm(
                        user,
                        [welcomeTask],
                        [welcomeTask],
                        [],
                    );

                    const suggested = algo.getWelcomeTasks();

                    expect(suggested.map((s) => s.task.id)).not.toContain('welcome');
                });

                it('still suggests eligible non-archived welcome tasks', () => {
                    const welcomeTask = makeRequirement('welcome', RequirementCategory.Welcome);
                    const user = makeUser({
                        archivedTasks: [],
                    });
                    const algo = new TaskSuggestionAlgorithm(
                        user,
                        [welcomeTask],
                        [welcomeTask],
                        [],
                    );

                    const suggested = algo.getWelcomeTasks();

                    expect(suggested.map((s) => s.task.id)).toContain('welcome');
                });
            });
            describe('getWeeklySuggestions', () => {
                it('still shows archived tasks from past days', () => {
                    // Make sure we're not on a Sunday, since there are no days
                    // of the week before that
                    const today = new Date();
                    if (today.getDay() === 0) {
                        today.setDate(today.getDate() + 2);
                    }
                    vi.setSystemTime(today);

                    const req = makeRequirement('task');
                    const user = makeUser({
                        archivedTasks: ['task'],
                        weeklyPlan: makeWeeklyPlan({
                            tasks: [
                                [{ id: 'task', minutes: 10 }],
                                [{ id: 'task', minutes: 10 }],
                                [{ id: 'task', minutes: 10 }],
                                [{ id: 'task', minutes: 10 }],
                                [{ id: 'task', minutes: 10 }],
                                [{ id: 'task', minutes: 10 }],
                                [{ id: 'task', minutes: 10 }],
                            ],
                        }),
                    });
                    const algo = new TaskSuggestionAlgorithm(user, [req], [req], []);

                    const suggestions = algo.getWeeklySuggestions();
                    expect(
                        suggestions.suggestionsByDay[new Date().getDay() - 1].map((s) => s.task.id),
                    ).toContain('task');
                });

                it('does not show archived tasks for the current day', () => {
                    const req = makeRequirement('task');
                    const user = makeUser({
                        archivedTasks: ['task'],
                        weeklyPlan: makeWeeklyPlan({
                            tasks: [
                                [{ id: 'task', minutes: 10 }],
                                [{ id: 'task', minutes: 10 }],
                                [{ id: 'task', minutes: 10 }],
                                [{ id: 'task', minutes: 10 }],
                                [{ id: 'task', minutes: 10 }],
                                [{ id: 'task', minutes: 10 }],
                                [{ id: 'task', minutes: 10 }],
                            ],
                        }),
                    });
                    const algo = new TaskSuggestionAlgorithm(user, [req], [req], []);

                    const suggestions = algo.getWeeklySuggestions();
                    expect(
                        suggestions.suggestionsByDay[new Date().getDay()].map((s) => s.task.id),
                    ).not.toContain('task');
                });

                it('does not show archived tasks for future days', () => {
                    // Make sure we're not on a Saturday, since there are no days
                    // of the week after that
                    const today = new Date();
                    if (today.getDay() === 6) {
                        today.setDate(today.getDate() - 2);
                    }
                    vi.setSystemTime(today);

                    const req = makeRequirement('task');
                    const user = makeUser({
                        archivedTasks: ['task'],
                        weeklyPlan: makeWeeklyPlan({
                            tasks: [
                                [{ id: 'task', minutes: 10 }],
                                [{ id: 'task', minutes: 10 }],
                                [{ id: 'task', minutes: 10 }],
                                [{ id: 'task', minutes: 10 }],
                                [{ id: 'task', minutes: 10 }],
                                [{ id: 'task', minutes: 10 }],
                                [{ id: 'task', minutes: 10 }],
                            ],
                        }),
                    });
                    const algo = new TaskSuggestionAlgorithm(user, [req], [req], []);

                    const suggestions = algo.getWeeklySuggestions();
                    expect(
                        suggestions.suggestionsByDay[new Date().getDay() + 1].map((s) => s.task.id),
                    ).not.toContain('task');
                });

                // Just to verify that our tests are well-constructed, and the task is being excluded
                // for the right reasons. In particular, too low a cohort count can cause a task to
                // be considered completed after a certain number of days and removed from latter days'
                // suggestions
                it('still shows eligible non-archived tasks for future days', () => {
                    // Make sure we're not on a Saturday, since there are no days
                    // of the week after that
                    const today = new Date();
                    if (today.getDay() === 6) {
                        today.setDate(today.getDate() - 2);
                    }
                    vi.setSystemTime(today);

                    const req = makeRequirement('task');
                    const user = makeUser({
                        archivedTasks: [],
                        weeklyPlan: makeWeeklyPlan({
                            tasks: [
                                [{ id: 'task', minutes: 10 }],
                                [{ id: 'task', minutes: 10 }],
                                [{ id: 'task', minutes: 10 }],
                                [{ id: 'task', minutes: 10 }],
                                [{ id: 'task', minutes: 10 }],
                                [{ id: 'task', minutes: 10 }],
                                [{ id: 'task', minutes: 10 }],
                            ],
                        }),
                    });
                    const algo = new TaskSuggestionAlgorithm(user, [req], [req], []);

                    const suggestions = algo.getWeeklySuggestions();
                    expect(
                        suggestions.suggestionsByDay[new Date().getDay() + 1].map((s) => s.task.id),
                    ).toContain('task');
                });
            });
        });
    });
});
