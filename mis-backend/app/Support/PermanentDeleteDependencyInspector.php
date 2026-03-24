<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class PermanentDeleteDependencyInspector
{
    public static function buildBlockedDeletePayload(string $entityLabel, Model $model, array $ignoreTables = []): array
    {
        $dependencies = self::inspect($model, $ignoreTables);

        return [
            'message' => $dependencies !== []
                ? sprintf('%s cannot be permanently deleted because related records still exist.', $entityLabel)
                : sprintf('%s could not be permanently deleted because other records still depend on it.', $entityLabel),
            'dependencies' => $dependencies,
        ];
    }

    public static function inspect(Model $model, array $ignoreTables = []): array
    {
        $database = DB::getDatabaseName();
        $table = trim((string) $model->getTable());
        $keyName = trim((string) $model->getKeyName());
        $keyValue = $model->getAttribute($keyName);

        if (!is_string($database) || trim($database) === '' || $table === '' || $keyName === '' || $keyValue === null || $keyValue === '') {
            return [];
        }

        $ignored = collect($ignoreTables)
            ->map(fn ($value) => strtolower(trim((string) $value)))
            ->filter()
            ->values();

        $references = DB::table('information_schema.KEY_COLUMN_USAGE')
            ->selectRaw('TABLE_NAME as table_name, COLUMN_NAME as column_name, CONSTRAINT_NAME as constraint_name')
            ->where('REFERENCED_TABLE_SCHEMA', $database)
            ->where('REFERENCED_TABLE_NAME', $table)
            ->where('REFERENCED_COLUMN_NAME', $keyName)
            ->get();

        $dependencies = [];

        foreach ($references as $reference) {
            $referencingTable = trim((string) ($reference->table_name ?? ''));
            $referencingColumn = trim((string) ($reference->column_name ?? ''));
            if ($referencingTable === '' || $referencingColumn === '') {
                continue;
            }

            if ($ignored->contains(strtolower($referencingTable))) {
                continue;
            }

            $query = DB::table($referencingTable)->where($referencingColumn, $keyValue);
            $count = (int) (clone $query)->count();
            if ($count <= 0) {
                continue;
            }

            $identifierColumn = self::resolveIdentifierColumn($referencingTable);
            $exampleIds = [];
            if ($identifierColumn !== null) {
                $exampleIds = (clone $query)
                    ->orderBy($identifierColumn)
                    ->limit(5)
                    ->pluck($identifierColumn)
                    ->map(fn ($value) => (string) $value)
                    ->filter()
                    ->values()
                    ->all();
            }

            $tableLabel = self::humanizeTable($referencingTable);
            $dependencies[] = [
                'table' => $referencingTable,
                'table_label' => $tableLabel,
                'column' => $referencingColumn,
                'constraint' => trim((string) ($reference->constraint_name ?? '')),
                'count' => $count,
                'example_ids' => $exampleIds,
                'action' => sprintf(
                    'Delete or reassign the related %s records first, then try this permanent delete again.',
                    $tableLabel
                ),
            ];
        }

        usort($dependencies, function (array $left, array $right): int {
            if ($left['count'] === $right['count']) {
                return strcmp($left['table'], $right['table']);
            }

            return $right['count'] <=> $left['count'];
        });

        return $dependencies;
    }

    private static function resolveIdentifierColumn(string $table): ?string
    {
        foreach (['id', 'uuid'] as $column) {
            if (Schema::hasColumn($table, $column)) {
                return $column;
            }
        }

        return null;
    }

    private static function humanizeTable(string $table): string
    {
        return ucwords(str_replace('_', ' ', trim($table)));
    }
}
