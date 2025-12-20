import { type ReactElement } from 'react'
import { BookOpen, Users, ChevronRight } from 'lucide-react'
import type { CourseSummary } from '../../../../shared/types'
import { Card } from '@/components/ui/card'

interface CourseCardProps {
  course: CourseSummary
  onClick?: () => void
}

export function CourseCard({ course, onClick }: CourseCardProps): ReactElement {
  return (
    <Card
      className="p-5 hover:border-primary/50 transition-colors cursor-pointer group"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.()
        }
      }}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <BookOpen className="w-5 h-5 text-primary" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate">{course.name}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {course.subject} &middot; Grade {course.gradeLevel}
          </p>

          {/* Stats */}
          <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Users size={14} />
              {course.sectionCount} {course.sectionCount === 1 ? 'section' : 'sections'}
            </span>
          </div>
        </div>

        {/* Arrow indicator */}
        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
      </div>
    </Card>
  )
}
