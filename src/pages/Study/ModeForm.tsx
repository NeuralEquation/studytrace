import type { Attempt } from "../../types/model";
import { ReproductionRunner } from "../../studyModes/reproduction/ReproductionRunner";
import { SpeedRunner } from "../../studyModes/speed/SpeedRunner";
import { DeepRecallRunner } from "../../studyModes/deepRecall/DeepRecallRunner";
import { VideoRunner } from "../../studyModes/video/VideoRunner";
import { ExamRunner } from "../../studyModes/exam/ExamRunner";
import { ReadingRunner } from "../../studyModes/reading/ReadingRunner";
import { MemorizationRunner } from "../../studyModes/memorization/MemorizationRunner";
import { PracticeRunner } from "../../studyModes/practice/PracticeRunner";
export function ModeForm({
  value,
  onChange,
}: {
  value: Attempt;
  onChange: (a: Attempt) => void;
}) {
  switch (value.mode) {
    case "reproduction":
      return <ReproductionRunner value={value} onChange={onChange} />;
    case "speed":
      return <SpeedRunner value={value} onChange={onChange} />;
    case "deep_recall":
      return <DeepRecallRunner value={value} onChange={onChange} />;
    case "video":
      return <VideoRunner value={value} onChange={onChange} />;
    case "past_exam":
      return <ExamRunner value={value} onChange={onChange} />;
    case "reading":
      return <ReadingRunner value={value} onChange={onChange} />;
    case "memorization":
      return <MemorizationRunner value={value} onChange={onChange} />;
    case "practice":
      return <PracticeRunner value={value} onChange={onChange} />;
  }
}
