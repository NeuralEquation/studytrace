import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, List } from "lucide-react";
import type { AppData, StudyItem, SprintGoal } from "../../types/model";
import { itemNeighbors, studyPath } from "../../features/study/itemNavigation";

export function ItemNavigation({
  data,
  item,
  goal,
}: {
  data: AppData;
  item: StudyItem;
  goal?: SprintGoal;
}) {
  const { previous, next, index, total } = itemNeighbors(data, item, goal);
  return (
    <nav className="study-navigation" aria-label="前後の授業・問題">
      {previous ? (
        <Link
          className="button secondary study-step"
          to={studyPath(previous, goal?.id)}
          aria-label={"前へ：" + previous.title}
        >
          <ChevronLeft size={18} />
          <span>
            <small>前へ</small>
            <strong>{previous.title}</strong>
          </span>
        </Link>
      ) : (
        <button className="secondary study-step" disabled>
          <ChevronLeft size={18} />
          前へ
        </button>
      )}
      <Link className="study-position" to={"/courses/" + item.courseId}>
        <List size={18} />
        <span>
          {index >= 0 ? `${index + 1} / ${total}` : "授業一覧"}
          <small>教材へ</small>
        </span>
      </Link>
      {next ? (
        <Link
          className="button secondary study-step next"
          to={studyPath(next, goal?.id)}
          aria-label={"次へ：" + next.title}
        >
          <span>
            <small>次へ</small>
            <strong>{next.title}</strong>
          </span>
          <ChevronRight size={18} />
        </Link>
      ) : (
        <button className="secondary study-step" disabled>
          次へ
          <ChevronRight size={18} />
        </button>
      )}
    </nav>
  );
}
