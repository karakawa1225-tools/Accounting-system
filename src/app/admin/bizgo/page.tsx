import { getBizgoExpenseLines, getBizgoTripExpenseLines } from "./actions";
import { BizgoView } from "./view";

export default async function BizgoPage() {
  const [expenseLines, tripLines] = await Promise.all([getBizgoExpenseLines(), getBizgoTripExpenseLines()]);
  return <BizgoView expenseLines={expenseLines} tripLines={tripLines} />;
}
