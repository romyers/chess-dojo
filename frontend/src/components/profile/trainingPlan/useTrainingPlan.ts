import { useApi } from '@/api/Api';
import { useRequirements } from '@/api/cache/requirements';
import { Request } from '@/api/Request';
import { useAuth } from '@/auth/Auth';
import { CustomTask, Requirement } from '@/database/requirement';
import { TimelineEntry } from '@/database/timeline';
import { ALL_COHORTS, User, WeeklyPlan, WorkGoalSettings } from '@/database/user';
import { useEffect, useMemo } from 'react';
import { useTimelineContext } from '../activity/useTimeline';
import { GRADUATION_TASK_ID } from './full/FullTrainingPlanSection';
import { CLASSICAL_GAMES_TASK_ID, SuggestedTask, TaskSuggestionAlgorithm } from './suggestedTasks';

export interface UseTrainingPlanResponse {
    /** The request for fetching requirements. */
    request: Request<never>;
    /** The requirements in the given cohort. */
    requirements: Requirement[];
    /** All the requirements in the training plan, across all cohorts. */
    allRequirements: Requirement[];
    /** The tasks the user has pinned. */
    pinnedTasks: (Requirement | CustomTask)[];
    /** A callback function to toggle whether a task is pinned. */
    togglePin: (task: Requirement | CustomTask) => void;
    /** A callback function to toggle whether a task is archived */
    toggleArchived: (task: Requirement | CustomTask) => void;
    /** The user passed as a parameter, unchanged. */
    user: User;
    /** Whether the provided user is the current logged in user. */
    isCurrentUser: boolean;
    /** The ids of tasks the user has archived. */
    archivedTaskIds: string[];
    /** The ids of tasks the user has skipped for the current week. */
    skippedTaskIds?: string[];
    /** A callback function to toggle whether a task is skipped. */
    toggleSkip: (...ids: string[]) => void;
    /** A function to determine if a task can be archived based on its ID. */
    isArchivableTaskId: (taskId: string) => boolean;
}

/**
 * Returns common data and functions used across all Training Plan tabs.
 * @param user The user to display the training plan for.
 * @param cohort The cohort to display the training plan for.
 */
export function useTrainingPlan(user: User, cohort?: string): UseTrainingPlanResponse {
    const { user: currentUser, updateUser } = useAuth();
    const api = useApi();
    const { request, requirements: allRequirements } = useRequirements(ALL_COHORTS, false);
    const { requirements } = useRequirements(cohort || user.dojoCohort, false);
    const pinnedTasks = useMemo(() => {
        return (
            user.pinnedTasks
                ?.map(
                    (id) =>
                        user.customTasks?.find((task) => task.id === id) ||
                        allRequirements.find((task) => task.id === id),
                )
                .filter((t) => !!t) ?? []
        );
    }, [user, allRequirements]);
    const archivedTaskIds = useMemo(() => {
        return user.archivedTasks ?? [];
    }, [user]);

    const togglePin = (task: Requirement | CustomTask) => {
        const isPinned = pinnedTasks.some((t) => t.id === task.id);
        const newPinnedTasks = isPinned
            ? pinnedTasks.filter((t) => t.id !== task.id)
            : [...pinnedTasks, task];
        const newIds = newPinnedTasks.map((t) => t.id);

        updateUser({ pinnedTasks: newIds });
        void api.updateUser({ pinnedTasks: newIds });
    };

    // Determines if a task can be archived based on its ID.
    const isArchivableTaskId = (taskId: string) => {
        if (taskId === CLASSICAL_GAMES_TASK_ID) {
            return false;
        }

        if (taskId === GRADUATION_TASK_ID) {
            return false;
        }

        return true;
    };

    const toggleArchived = (task: Requirement | CustomTask) => {
        if (!isArchivableTaskId(task.id)) {
            return;
        }
        const isArchived = archivedTaskIds.some((id) => id === task.id);
        const newArchivedTasks = isArchived
            ? archivedTaskIds.filter((id) => id !== task.id)
            : [...archivedTaskIds, task.id];

        updateUser({ archivedTasks: newArchivedTasks });
        void api.updateUser({ archivedTasks: newArchivedTasks });
    };

    const toggleSkip = (...ids: string[]) => {
        if (!user.weeklyPlan) {
            return;
        }
        const skippedTasks = [...(user.weeklyPlan.skippedTasks ?? []), ...ids];
        const newPlan = { ...user.weeklyPlan, skippedTasks };
        updateUser({ weeklyPlan: newPlan });
        void api.updateUser({ weeklyPlan: newPlan });
    };

    return {
        user,
        request,
        requirements,
        allRequirements,
        pinnedTasks,
        togglePin,
        archivedTaskIds,
        toggleArchived,
        isCurrentUser: currentUser?.username === user.username,
        skippedTaskIds: user.weeklyPlan?.skippedTasks,
        toggleSkip,
        isArchivableTaskId,
    };
}

export interface UseWeeklyTrainingPlanResponse extends UseTrainingPlanResponse {
    /** The list of suggestions, indexed by the day of the week. */
    suggestionsByDay: SuggestedTask[][];
    /** The suggestions for the entire week, combined into a single flat list. */
    weekSuggestions: SuggestedTask[];
    /** The start date of the week. */
    startDate: string;
    /** The end date of the week. */
    endDate: string;
    /** Whether the weekly training plan is still loading. */
    isLoading: boolean;
    /** The user's timeline. */
    timeline: TimelineEntry[];
}

export function useWeeklyTrainingPlan(user: User): UseWeeklyTrainingPlanResponse {
    const api = useApi();
    const trainingPlan = useTrainingPlan(user);
    const { pinnedTasks, archivedTaskIds, requirements, allRequirements, isCurrentUser } =
        trainingPlan;
    const { entries: timeline } = useTimelineContext();

    const { suggestionsByDay, weekSuggestions, endDate, progressUpdatedAt, nextGame } =
        useMemo(() => {
            const result = new TaskSuggestionAlgorithm(
                user,
                requirements,
                allRequirements,
                timeline,
            ).getWeeklySuggestions();

            const weekSuggestions: SuggestedTask[] = [];
            for (const day of result.suggestionsByDay) {
                for (const suggestion of day) {
                    const existing = weekSuggestions.find((s) => s.task.id === suggestion.task.id);
                    if (existing) {
                        existing.goalMinutes += suggestion.goalMinutes;
                    } else {
                        weekSuggestions.push({ ...suggestion });
                    }
                }
            }

            return { ...result, weekSuggestions };
        }, [user, requirements, allRequirements, timeline]);

    const savedPlan = user.weeklyPlan;
    const isLoading = requirements.length === 0;
    useEffect(() => {
        if (
            !isCurrentUser ||
            equalPlans(savedPlan, {
                suggestionsByDay,
                endDate,
                progressUpdatedAt,
                pinnedTasks: pinnedTasks.map((t) => t.id),
                archivedTasks: archivedTaskIds,
                nextGame,
            }) ||
            isEmpty(suggestionsByDay) ||
            isLoading
        ) {
            return;
        }

        const newPlan = {
            endDate,
            tasks: suggestionsByDay.map((day) =>
                day.map((suggestion) => ({
                    id: suggestion.task.id,
                    minutes: suggestion.goalMinutes,
                })),
            ),
            progressUpdatedAt,
            pinnedTasks: pinnedTasks.map((t) => t.id),
            archivedTasks: archivedTaskIds,
            nextGame,
            skippedTasks:
                (savedPlan?.endDate ?? '') >= endDate ? savedPlan?.skippedTasks : undefined,
        };

        void api.updateUser({
            weeklyPlan: newPlan,
        });
    }, [
        isCurrentUser,
        savedPlan,
        suggestionsByDay,
        endDate,
        progressUpdatedAt,
        pinnedTasks,
        archivedTaskIds,
        nextGame,
        api,
        isLoading,
    ]);

    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 7);

    return {
        ...trainingPlan,
        suggestionsByDay,
        weekSuggestions,
        endDate,
        startDate: startDate.toISOString(),
        isLoading,
        timeline,
    };
}

/**
 * Returns the number of minutes the user is expected to work today.
 * @param workGoal The work goal settings of the user.
 */
export function getTodaysWorkGoal(workGoal: WorkGoalSettings): number {
    const dayIndex = new Date().getDay();
    return workGoal.minutesPerDay[dayIndex];
}

/**
 * Returns true if the given saved plan is equivalent to the given new plan.
 * @param savedPlan The saved weekly plan to check.
 * @param newPlan The new plan to check.
 */
function equalPlans(
    savedPlan: WeeklyPlan | undefined,
    newPlan: {
        suggestionsByDay: SuggestedTask[][];
        endDate: string;
        progressUpdatedAt: string;
        pinnedTasks: string[];
        archivedTasks: string[];
        nextGame: string;
    },
) {
    if (!savedPlan) {
        return false;
    }
    if (savedPlan.endDate !== newPlan.endDate) {
        return false;
    }
    if (savedPlan.progressUpdatedAt !== newPlan.progressUpdatedAt) {
        return false;
    }
    if (savedPlan.nextGame !== newPlan.nextGame) {
        return false;
    }

    // We want savedPlan.pinnedTasks = undefined and newPlan.pinnedTasks = [] to be considered equal
    // to avoid triggering regenerations on rollout.
    const savedPinnedTasks = savedPlan.pinnedTasks ?? [];
    const newPinnedTasks = newPlan.pinnedTasks ?? [];
    if (savedPinnedTasks.length !== newPinnedTasks.length) {
        return false;
    }
    for (let i = 0; i < newPinnedTasks.length; i++) {
        if (savedPinnedTasks[i] !== newPinnedTasks[i]) {
            return false;
        }
    }

    // We want savedPlan.archivedTasks = undefined and newPlan.archivedTasks = [] to be considered equal
    // to avoid triggering regenerations on rollout.
    const savedArchivedTasks = savedPlan.archivedTasks ?? [];
    const newArchivedTasks = newPlan.archivedTasks ?? [];
    if (savedArchivedTasks.length !== newArchivedTasks.length) {
        return false;
    }
    for (let i = 0; i < newArchivedTasks.length; i++) {
        if (savedArchivedTasks[i] !== newArchivedTasks[i]) {
            return false;
        }
    }

    for (let i = 0; i < savedPlan.tasks.length; i++) {
        const savedTasks = savedPlan.tasks[i];
        const newTasks = newPlan.suggestionsByDay[i];
        if (savedTasks.length !== newTasks.length) {
            return false;
        }
        for (let j = 0; j < savedTasks.length; j++) {
            if (
                savedTasks[j].id !== newTasks[j].task.id ||
                savedTasks[j].minutes !== newTasks[j].goalMinutes
            ) {
                return false;
            }
        }
    }
    return true;
}

function isEmpty(suggestionsByDay: SuggestedTask[][]) {
    return suggestionsByDay.every((day) => day.length === 0);
}

/**
 * Returns the progress on the training plan based on the given parameters.
 * @param startDate The start date of the timeframe to calculate progress for.
 * @param endDate The end date of the timeframe to calculate progress for.
 * @param tasks The suggested tasks for the given timeframe.
 * @param timeline The user's timeline to use when calculating progress.
 * @returns The goal, the time worked on the suggested tasks, the total time worked
 * including extra tasks, and the ids of any extra tasks worked on.
 */
export function useTrainingPlanProgress({
    startDate,
    endDate,
    tasks,
    timeline,
}: {
    startDate: string;
    endDate: string;
    tasks?: SuggestedTask[];
    timeline: TimelineEntry[];
}): [number, number, number, Set<string>] {
    return useMemo(() => {
        const goalMinutes = tasks?.reduce((sum, { goalMinutes }) => sum + goalMinutes, 0) ?? 0;
        const extraTaskIds = new Set<string>();

        let suggestedTimeWorked = 0;
        let totalTimeWorked = 0;
        for (const entry of timeline) {
            const date = entry.date || entry.createdAt;
            const isSuggestedTask = tasks?.some(({ task }) => task.id === entry.requirementId);
            if (date >= startDate && date < endDate) {
                totalTimeWorked += entry.minutesSpent;
                if (!isSuggestedTask) {
                    extraTaskIds.add(entry.requirementId);
                } else {
                    suggestedTimeWorked += entry.minutesSpent;
                }
            }
        }

        return [goalMinutes, suggestedTimeWorked, totalTimeWorked, extraTaskIds];
    }, [tasks, startDate, endDate, timeline]);
}
