-- Alle Referenzen auf diese Employees auf NULL setzen
  UPDATE public.projects                                                                                                                                                                                   
  SET project_manager_id = NULL
  WHERE project_manager_id IN (SELECT id FROM public.employees WHERE user_id IN (SELECT id FROM auth.users WHERE email IN                                                                                  
  ('manuel.fades50@gmail.com')));                                                                                                           
                                                                                                                                                                                                           
  UPDATE public.project_logs                                                                                                                                                                               
  SET employee_id = NULL                                    
  WHERE employee_id IN (SELECT id FROM public.employees WHERE user_id IN (SELECT id FROM auth.users WHERE email IN
  ('manuel.fades50@gmail.com')));                                                                                                           
   
  UPDATE public.todos                                                                                                                                                                                      
  SET assigned_to = NULL                                    
  WHERE assigned_to IN (SELECT id FROM public.employees WHERE user_id IN (SELECT id FROM auth.users WHERE email IN                                                                                         
  ('manuel.fades50@gmail.com')));                                                                                                           
                                                                                                                                                                                                           
  DELETE FROM public.time_entries                                                                                                                                                                          
  WHERE employee_id IN (SELECT id FROM public.employees WHERE user_id IN (SELECT id FROM auth.users WHERE email IN
  ('manuel.fades50@gmail.com')));                                                                                                           
   
  DELETE FROM public.resource_allocations                                                                                                                                                                  
  WHERE employee_id IN (SELECT id FROM public.employees WHERE user_id IN (SELECT id FROM auth.users WHERE email IN
  ('manuel.fades50@gmail.com')));                                                                                                           
   
  DELETE FROM public.calendar_events                                                                                                                                                                       
  WHERE employee_id IN (SELECT id FROM public.employees WHERE user_id IN (SELECT id FROM auth.users WHERE email IN
  ('manuel.fades50@gmail.com')));                                                                                                           
                                                            
  DELETE FROM public.external_calendars                                                                                                                                                                    
  WHERE employee_id IN (SELECT id FROM public.employees WHERE user_id IN (SELECT id FROM auth.users WHERE email IN
  ('manuel.fades50@gmail.com')));                                                                                                           
   
  -- Jetzt Employee-Records löschen                                                                                                                                                                        
  DELETE FROM public.employees                              
  WHERE user_id IN (SELECT id FROM auth.users WHERE email IN ('manuel.fades50@gmail.com'));
                                                                                                                                                                                                           
  -- Auth-User löschen                                                                                                                                                                                     
  DELETE FROM auth.users                                                                                                                                                                                   
  WHERE email IN ('manuel.fades50@gmail.com');