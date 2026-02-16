import React from 'react';
import { DashboardConfig, WidgetId, Project, Client, Todo } from '../../types';
import ProjectListWidget from './Widgets/ProjectListWidget';
import TimeTrackingWidget from './Widgets/TimeTrackingWidget';
import CalendarWidget from './Widgets/CalendarWidget';

interface DashboardGridProps {
    config: DashboardConfig;
    projects: Project[];
    selectedClient: Client | null;
    onSelectProject: (project: Project) => void;
    onTaskClick: (task: Todo) => void;
    todaysHours: number;
    onAddTime: () => void;
}

const WIDGET_COMPONENTS: Record<WidgetId, React.ComponentType<any>> = {
    projects: ProjectListWidget,
    time_tracking: TimeTrackingWidget,
    calendar: CalendarWidget,
    todos: () => <div className="p-6 bg-white rounded-3xl border border-gray-100 text-gray-400 text-xs italic">Aufgaben Widget (In Arbeit)</div>,
    resource_planning: () => <div className="p-6 bg-white rounded-3xl border border-gray-100 text-gray-400 text-xs italic">Resource Planner Widget (In Arbeit)</div>,
};

export default function DashboardGrid({ config, ...props }: DashboardGridProps) {
    // Determine which widgets to show and in what order
    const visibleWidgets = config.order.filter(id => config.visible.includes(id));

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-12 items-start">
            {visibleWidgets.map(id => {
                const Widget = WIDGET_COMPONENTS[id];
                if (!Widget) return null;

                // Projects and Resource Planning take full width in the grid
                const isWide = id === 'projects' || id === 'resource_planning';

                return (
                    <div key={id} className={`animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both ${isWide ? 'lg:col-span-2' : ''}`}>
                        <Widget {...props} />
                    </div>
                );
            })}
        </div>
    );
}
