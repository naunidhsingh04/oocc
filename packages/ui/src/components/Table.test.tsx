import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "./Table";

describe("Table", () => {
  it("renders header and body cells as a real <table>", () => {
    render(
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Channel</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          <TableRow>
            <TableCell>ch1</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Channel" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "ch1" })).toBeInTheDocument();
  });
});
