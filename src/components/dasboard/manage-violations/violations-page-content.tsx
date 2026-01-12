"use client";
import { useViolations } from "@/hooks/use-violations";
import ViolationsTable from "./violations-table";

const ViolationsPageContent = () => {
  const {
    violations,
    setViolations,
    filteredViolations,
    loading,
    refreshViolations,
    error,
    searchTerm,
    setSearchTerm,
    violationType,
    setViolationType,
    statusFilter,
    setStatusFilter,
  } = useViolations();
  return (
    <div>
      <ViolationsTable />
    </div>
  );
};

export default ViolationsPageContent;
