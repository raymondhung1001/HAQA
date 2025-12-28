@echo off
echo Stopping Docker containers...
docker compose down
if errorlevel 1 (
    echo Error: Failed to stop Docker containers
    pause
    exit /b 1
)

echo Removing Docker volume haqa_haqa_db_data...
docker volume rm haqa_haqa_db_data
if errorlevel 1 (
    echo Warning: Failed to remove volume (it may not exist)
)

echo Starting Docker containers...
docker compose up -d
if errorlevel 1 (
    echo Error: Failed to start Docker containers
    pause
    exit /b 1
)

echo Docker reset completed successfully!
pause

