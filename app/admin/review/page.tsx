import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { listPendingReviews } from "@/lib/wiki/pending-review";
import { ReviewQueue } from "@/components/admin/ReviewQueue";

export default async function ReviewPage() {
  const items = listPendingReviews();

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6">
        <div className="mb-6">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-city-navy mb-3"
          >
            <ArrowLeft size={14} />
            Back to Admin
          </Link>
          <h1 className="text-2xl font-bold text-city-navy">Pending Review</h1>
          <p className="text-sm text-gray-400 mt-1">
            AI-generated wiki content and council recommendations wait here until approved — nothing below is visible to chat or the dashboard yet.
          </p>
        </div>

        <ReviewQueue initialItems={items} />
      </div>
    </div>
  );
}
