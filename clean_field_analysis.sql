-- 불필요하게 자동 생성되었던 field 분석 레코드 삭제
-- (주의: comments 테이블의 외래키는 ON DELETE CASCADE이므로 연관 코멘트도 함께 정리됩니다)
DELETE FROM public.records 
WHERE type = 'analysis' AND category = 'field';
