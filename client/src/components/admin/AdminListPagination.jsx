import { TablePagination } from '@mui/material';

const ROWS = [10, 15, 20, 25, 50];

/**
 * MUI phân trang dưới bảng (0-based `page` giống TablePagination).
 */
export function AdminListPagination({ page, pageSize, total, onPageChange, onPageSizeChange, labelRowsPerPage, labelDisplayedRows, sx }) {
  return (
    <TablePagination
      component="div"
      size="small"
      sx={sx}
      count={total}
      page={page}
      onPageChange={onPageChange}
      rowsPerPage={pageSize}
      onRowsPerPageChange={onPageSizeChange}
      rowsPerPageOptions={ROWS}
      labelRowsPerPage={labelRowsPerPage}
      labelDisplayedRows={labelDisplayedRows}
    />
  );
}
