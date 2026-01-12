import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
//  violations,
//     setViolations,
//     filteredViolations,
//     loading,
//     refreshViolations,
//     error,
//     searchTerm,
//     setSearchTerm,
//     violationType,
//     setViolationType,
//     statusFilter,
//     setStatusFilter,

const ViolationsTable = () => {
  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>Code</TableHead>
            <TableHead>Violation</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Juan Dela Cruz</TableCell>
            <TableCell>EMP-001</TableCell>
            <TableCell>LATE</TableCell>
            <TableCell>2025-01-06</TableCell>
            <TableCell>₱500</TableCell>
            <TableCell>WAIVED</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
};

export default ViolationsTable;
